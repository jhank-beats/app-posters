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
        $mail->Timelimit = 10;
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

// Encola el correo en la tabla cola_correos (drenada por cron).
// Si SMTP no está configurado, no encola (evita filas que nunca se envían).
function encolarCorreoFondo($destinatario, $asunto, $mensajeHtml)
{
    global $conexion;

    $smtpUser = correo_env('SMTP_USER', '');
    $smtpPass = correo_env('SMTP_PASS', '');
    $smtpHost = correo_env('SMTP_HOST', '');
    if ($smtpHost === '' || $smtpUser === '' || $smtpPass === '') {
        error_log("encolarCorreoFondo: SMTP no configurado; correo omitido a {$destinatario}");
        return false;
    }

    $html = correo_asegurar_plantilla($asunto, $mensajeHtml);

    if (isset($conexion) && $conexion instanceof mysqli) {
        try {
            $stmt = $conexion->prepare(
                "INSERT INTO cola_correos (destinatario, asunto, mensaje, estado, intentos) VALUES (?, ?, ?, 'pendiente', 0)"
            );
            if ($stmt) {
                $stmt->bind_param("sss", $destinatario, $asunto, $html);
                if ($stmt->execute()) {
                    $stmt->close();
                    return true;
                }
                $stmt->close();
            }
        } catch (Throwable $e) {
            error_log('encolarCorreoFondo: ' . $e->getMessage());
        }
    }

    // Fallback legacy: proceso CLI (solo si exec está disponible).
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

    if (is_array($loteCorreos)) {
        foreach ($loteCorreos as $item) {
            if (!is_array($item)) continue;
            $dest = $item['correo'] ?? $item['destinatario'] ?? null;
            $asunto = $item['asunto'] ?? null;
            $cuerpo = $item['cuerpo'] ?? $item['mensaje'] ?? null;
            if ($dest && $asunto && $cuerpo) {
                encolarCorreoFondo($dest, $asunto, $cuerpo);
            }
        }
    }
}

// Alias compatible para llamadas desde CLI / helpers
function enviarCorreo($destinatario, $asunto, $mensajeHtml)
{
    return enviarCorreoNotificacion($destinatario, $asunto, $mensajeHtml);
}
?>