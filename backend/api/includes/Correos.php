<?php
// backend/api/includes/Correos.php

// Ruta absoluta estricta basada en la ubicación actual de este archivo
$autoloadPath = __DIR__ . '/../../vendor/autoload.php';

if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
} else {
    error_log('correo: falta autoload PHPMailer');
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * Lee una variable de configuración SMTP desde el entorno o backend/.env.
 * Sin respaldos en código: en producción SMTP_USER y SMTP_PASS son obligatorios.
 */
function correo_env($clave, $porDefecto = '')
{
    if (!function_exists('app_env')) {
        require_once __DIR__ . '/Env.php';
    }
    $v = app_env($clave);
    return ($v === null || $v === '') ? $porDefecto : $v;
}

/**
 * Asegura la existencia de la tabla configuracion_sistema y la columna correos_habilitados en eventos.
 */
function correos_asegurar_tablas_y_columnas($conexion = null)
{
    static $verificado = false;
    if ($verificado) return;

    if (!$conexion || !($conexion instanceof mysqli)) {
        global $conexion;
    }
    if (!$conexion || !($conexion instanceof mysqli)) {
        return;
    }
    $verificado = true;

    // 1. Tabla de configuración del sistema (clave-valor)
    @$conexion->query("CREATE TABLE IF NOT EXISTS `configuracion_sistema` (
        `clave` VARCHAR(64) NOT NULL PRIMARY KEY,
        `valor` VARCHAR(255) NOT NULL,
        `descripcion` VARCHAR(255) NULL,
        `actualizado_en` DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Insertar valor por defecto global si no existe
    @$conexion->query("INSERT IGNORE INTO `configuracion_sistema` (`clave`, `valor`, `descripcion`, `actualizado_en`) 
        VALUES ('correos_global_habilitados', '1', 'Interruptor general de correos para todo el sistema', NOW())");

    // 2. Columna correos_habilitados en eventos
    $resCol = @$conexion->query("SHOW COLUMNS FROM `eventos` LIKE 'correos_habilitados'");
    if ($resCol && $resCol->num_rows === 0) {
        @$conexion->query("ALTER TABLE `eventos` ADD COLUMN `correos_habilitados` TINYINT(1) NOT NULL DEFAULT 1");
    }

    // 3. Columna carrera e id_evento en cola_correos para rastreo y filtrado
    $resColCola1 = @$conexion->query("SHOW COLUMNS FROM `cola_correos` LIKE 'carrera'");
    if ($resColCola1 && $resColCola1->num_rows === 0) {
        @$conexion->query("ALTER TABLE `cola_correos` ADD COLUMN `carrera` VARCHAR(20) NULL DEFAULT NULL");
    }
    $resColCola2 = @$conexion->query("SHOW COLUMNS FROM `cola_correos` LIKE 'id_evento'");
    if ($resColCola2 && $resColCola2->num_rows === 0) {
        @$conexion->query("ALTER TABLE `cola_correos` ADD COLUMN `id_evento` INT NULL DEFAULT NULL");
    }
}

/**
 * Consulta si los correos están habilitados globalmente en la base de datos.
 */
function correos_global_habilitados($conexion = null)
{
    if (!$conexion || !($conexion instanceof mysqli)) {
        global $conexion;
    }
    if (!$conexion || !($conexion instanceof mysqli)) {
        return true;
    }
    correos_asegurar_tablas_y_columnas($conexion);
    $res = @$conexion->query("SELECT valor FROM configuracion_sistema WHERE clave = 'correos_global_habilitados' LIMIT 1");
    if ($res && ($row = $res->fetch_assoc())) {
        return intval($row['valor']) === 1;
    }
    return true;
}

/**
 * Consulta si los correos están habilitados para una carrera o evento específico.
 */
function correos_carrera_habilitados($carreraOIdEvento, $conexion = null)
{
    if (!$conexion || !($conexion instanceof mysqli)) {
        global $conexion;
    }
    if (!$conexion || !($conexion instanceof mysqli)) {
        return true;
    }
    correos_asegurar_tablas_y_columnas($conexion);

    if (is_numeric($carreraOIdEvento) && intval($carreraOIdEvento) > 0) {
        $stmt = @$conexion->prepare("SELECT correos_habilitados FROM eventos WHERE id_evento = ? LIMIT 1");
        if ($stmt) {
            $idEv = intval($carreraOIdEvento);
            $stmt->bind_param("i", $idEv);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && ($row = $res->fetch_assoc())) {
                $stmt->close();
                return intval($row['correos_habilitados'] ?? 1) === 1;
            }
            $stmt->close();
        }
    } else {
        $carreraNorm = function_exists('ph_normalizar_carrera') 
            ? ph_normalizar_carrera((string)$carreraOIdEvento) 
            : strtolower(trim((string)$carreraOIdEvento));

        if ($carreraNorm === 'ambas') {
            $res = @$conexion->query("SELECT correos_habilitados FROM eventos WHERE activo = 1");
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    if (intval($row['correos_habilitados'] ?? 1) === 0) {
                        return false;
                    }
                }
            }
            return true;
        }

        if (function_exists('ph_evento_activo')) {
            $idEvAct = ph_evento_activo($conexion, $carreraNorm);
            if ($idEvAct > 0) {
                return correos_carrera_habilitados($idEvAct, $conexion);
            }
        }

        $stmt = @$conexion->prepare(
            "SELECT correos_habilitados FROM eventos WHERE activo = 1 AND (carrera = ? OR carrera = 'ambas') ORDER BY (carrera = ?) DESC, id_evento ASC LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("ss", $carreraNorm, $carreraNorm);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && ($row = $res->fetch_assoc())) {
                $stmt->close();
                return intval($row['correos_habilitados'] ?? 1) === 1;
            }
            $stmt->close();
        }
    }
    return true;
}

/**
 * Determina si el envío de correos está pausado o deshabilitado.
 * Puede evaluarse a nivel global o para una carrera / evento específico.
 */
function correos_estan_deshabilitados($carrera = null, $id_evento = null)
{
    $disable = strtolower(trim((string)correo_env('DISABLE_EMAILS', 'false')));
    if ($disable === 'true' || $disable === '1') {
        return true;
    }
    $habilitados = strtolower(trim((string)correo_env('CORREOS_HABILITADOS', 'true')));
    if ($habilitados === 'false' || $habilitados === '0') {
        return true;
    }

    global $conexion;
    if ($conexion instanceof mysqli) {
        if (!correos_global_habilitados($conexion)) {
            return true;
        }

        if ($id_evento !== null && intval($id_evento) > 0) {
            if (!correos_carrera_habilitados(intval($id_evento), $conexion)) {
                return true;
            }
        } elseif ($carrera !== null && trim((string)$carrera) !== '' && trim((string)$carrera) !== 'todas') {
            if (!correos_carrera_habilitados((string)$carrera, $conexion)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Envuelve el cuerpo HTML en la plantilla con marca institucional si aún no la lleva.
 */
function correo_asegurar_plantilla($asunto, $mensajeHtml)
{
    if (strpos($mensajeHtml, 'Universidad Cooperativa de Colombia') !== false) {
        return $mensajeHtml;
    }
    if (function_exists('rh_plantilla_correo')) {
        return rh_plantilla_correo($asunto, $mensajeHtml);
    }
    $titulo = htmlspecialchars((string)$asunto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    return "
    <div style='font-family: Arial, Helvetica, sans-serif; background:#f5f7f8; padding:24px;'>
      <div style='max-width:620px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border-top:4px solid #00acc9;'>
        <div style='background:#132740; padding:18px 24px;'>
          <span style='color:#cad400; font-size:12px; letter-spacing:2px; text-transform:uppercase;'>Universidad Cooperativa de Colombia</span>
          <h2 style='color:#ffffff; margin:6px 0 0; font-size:20px;'>{$titulo}</h2>
        </div>
        <div style='padding:24px; color:#5f5e5e; font-size:15px; line-height:1.6;'>
          {$mensajeHtml}
        </div>
        <div style='background:#f5f7f8; padding:16px 24px; color:#5f5e5e; font-size:12px;'>
          Sistema de Gestión de Pósteres — GensTI. Este es un mensaje automático, por favor no respondas a este correo.
        </div>
      </div>
    </div>";
}

function enviarCorreoNotificacion($destinatario, $asunto, $mensajeHtml)
{
    // INTERRUPTOR DE SEGURIDAD: Pausar envíos si está configurado en .env
    if (correos_estan_deshabilitados()) {
        error_log("correo: ENVÍO DESHABILITADO POR CONFIGURACIÓN (destinatario: {$destinatario}, asunto: {$asunto})");
        return true; // Retorna true para que la cola o el flujo no consideren que falló ni hagan reintentos
    }

    error_log('correo: iniciando envío');

    try {
        $mail = new PHPMailer(true);

        $smtpHost = correo_env('SMTP_HOST', '');
        $smtpPort = intval(correo_env('SMTP_PORT', '587'));
        $smtpUser = correo_env('SMTP_USER', '');
        $smtpPass = correo_env('SMTP_PASS', '');
        $smtpFrom = correo_env('SMTP_FROM', $smtpUser);
        $smtpFromName = correo_env('SMTP_FROM_NAME', 'Sistema de Pósteres');

        if ($smtpHost === '' || $smtpUser === '' || $smtpPass === '') {
            error_log('correo: SMTP no configurado; omitido');
            return false;
        }

        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort > 0 ? $smtpPort : 587;
        // Evitar esperas largas: Gmail suele tardar 2-4s en el handshake TLS.
        $mail->Timeout = 10;
        $mail->SMTPDebug = 0;

        $mail->setFrom($smtpFrom, $smtpFromName);
        $mail->addAddress($destinatario);

        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = $asunto;
        $mail->Body = correo_asegurar_plantilla($asunto, $mensajeHtml);

        $mail->send();
        error_log('correo: enviado');
        return true;
    } catch (Exception $e) {
        error_log('correo: fallo PHPMailer: ' . $e->getMessage());
        return false;
    }
}

// Dispara el drenaje de cola en segundo plano (no depende solo del cron).
function correo_disparar_drenaje_cola()
{
    // Si los correos están deshabilitados, no disparar drenaje
    if (correos_estan_deshabilitados()) {
        return false;
    }

    if (!function_exists('exec') || strpos((string)ini_get('disable_functions'), 'exec') !== false) {
        return false;
    }
    $script = __DIR__ . '/../../tareas/ColaCorreos.php';
    if (!is_file($script)) {
        return false;
    }
    exec('php ' . escapeshellarg($script) . ' > /dev/null 2>&1 &');
    return true;
}

// Encola el correo en la tabla cola_correos (drenada por cron + disparo en vivo).
// Si SMTP no está configurado, no encola (evita filas que nunca se envían).
function encolarCorreoFondo($destinatario, $asunto, $mensajeHtml, $dispararDrenaje = true, $carrera = null, $id_evento = null)
{
    global $conexion;

    // Si los correos están deshabilitados (global o para esta carrera), ni siquiera encolar
    if (correos_estan_deshabilitados($carrera, $id_evento)) {
        error_log("encolarCorreoFondo: correos deshabilitados por configuración para " . ($carrera ?? $id_evento ?? 'global') . ", omitiendo {$destinatario}");
        return true;
    }

    $smtpUser = correo_env('SMTP_USER', '');
    $smtpPass = correo_env('SMTP_PASS', '');
    $smtpHost = correo_env('SMTP_HOST', '');
    if ($smtpHost === '' || $smtpUser === '' || $smtpPass === '') {
        error_log('encolarCorreoFondo: SMTP no configurado; correo omitido');
        return false;
    }

    $html = correo_asegurar_plantilla($asunto, $mensajeHtml);

    if (isset($conexion) && $conexion instanceof mysqli) {
        try {
            correos_asegurar_tablas_y_columnas($conexion);

            $idEv = ($id_evento !== null && intval($id_evento) > 0) ? intval($id_evento) : null;
            $carr = ($carrera !== null && trim((string)$carrera) !== '') ? strtolower(trim((string)$carrera)) : null;

            $stmt = $conexion->prepare(
                "INSERT INTO cola_correos (destinatario, asunto, mensaje, estado, intentos, carrera, id_evento) VALUES (?, ?, ?, 'pendiente', 0, ?, ?)"
            );
            if ($stmt) {
                $stmt->bind_param("ssssi", $destinatario, $asunto, $html, $carr, $idEv);
                if ($stmt->execute()) {
                    $stmt->close();
                    if ($dispararDrenaje) {
                        correo_disparar_drenaje_cola();
                    }
                    return true;
                }
                $stmt->close();
            } else {
                // Si la tabla no tiene las columnas adicionales aún, fallback seguro
                $stmtFallback = $conexion->prepare(
                    "INSERT INTO cola_correos (destinatario, asunto, mensaje, estado, intentos) VALUES (?, ?, ?, 'pendiente', 0)"
                );
                if ($stmtFallback) {
                    $stmtFallback->bind_param("sss", $destinatario, $asunto, $html);
                    if ($stmtFallback->execute()) {
                        $stmtFallback->close();
                        if ($dispararDrenaje) correo_disparar_drenaje_cola();
                        return true;
                    }
                    $stmtFallback->close();
                }
            }
        } catch (Throwable $e) {
            error_log('encolarCorreoFondo: ' . $e->getMessage());
        }
    }

    // Fallback legacy: proceso CLI de un solo correo (si exec está disponible).
    if (function_exists('exec') && strpos((string)ini_get('disable_functions'), 'exec') === false) {
        $script = __DIR__ . '/EnviarCorreoFondo.php';
        $payload = base64_encode(json_encode([
            'destinatario' => $destinatario,
            'asunto' => $asunto,
            'mensaje' => $html,
        ]));
        exec('php ' . escapeshellarg($script) . ' ' . escapeshellarg($payload) . ' > /dev/null 2>&1 &', $out, $code);
        return $code === 0;
    }

    error_log('encolarCorreoFondo: no se pudo encolar (sin tabla ni exec)');
    return false;
}

// Envía la respuesta JSON al cliente de inmediato y deja el correo en fondo.
function responderJsonYNotificar($response, $destinatario = null, $asunto = null, $mensajeHtml = null)
{
    if (ob_get_length()) {
        ob_clean();
    }
    echo json_encode($response);

    if ($destinatario && $asunto && $mensajeHtml) {
        encolarCorreoFondo($destinatario, $asunto, $mensajeHtml);
    }
}

// Envía la respuesta JSON al cliente de inmediato y encola un lote de correos en segundo plano.
function responderJsonYNotificarLote($response, $loteCorreos = [])
{
    if (ob_get_length()) {
        ob_clean();
    }
    echo json_encode($response);

    if (is_array($loteCorreos) && count($loteCorreos) > 0) {
        $encolados = 0;
        foreach ($loteCorreos as $item) {
            if (!is_array($item)) continue;
            $dest = $item['correo'] ?? $item['destinatario'] ?? null;
            $asunto = $item['asunto'] ?? null;
            $cuerpo = $item['cuerpo'] ?? $item['mensaje'] ?? null;
            if ($dest && $asunto && $cuerpo) {
                // Encolar sin disparar exec en cada iteración para evitar procesos concurrentes
                if (encolarCorreoFondo($dest, $asunto, $cuerpo, false)) {
                    $encolados++;
                }
            }
        }
        // Disparar el drenaje de cola exactamente una vez para todo el lote
        if ($encolados > 0) {
            correo_disparar_drenaje_cola();
        }
    }
}

// Alias compatible para llamadas desde CLI / helpers
function enviarCorreo($destinatario, $asunto, $mensajeHtml)
{
    return enviarCorreoNotificacion($destinatario, $asunto, $mensajeHtml);
}
?>