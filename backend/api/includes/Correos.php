<?php
// backend/api/includes/Correos.php

// Ruta absoluta estricta basada en la ubicación actual de este archivo
$autoloadPath = __DIR__ . '/../../vendor/autoload.php';

if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
} else {
    file_put_contents('/tmp/correo_debug.txt', "ERROR: No se encontró el autoload en: {$autoloadPath}\n", FILE_APPEND);
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * Lee una variable de configuración SMTP desde el entorno (getenv / $_ENV / .env)
 * con valor de respaldo para desarrollo local.
 */
function correo_env($clave, $porDefecto = '')
{
    static $envArchivo = null;
    if ($envArchivo === null) {
        $envArchivo = [];
        $rutasEnv = [__DIR__ . '/../../.env', __DIR__ . '/../../../.env'];
        foreach ($rutasEnv as $ruta) {
            if (is_readable($ruta)) {
                $lineas = @file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if (is_array($lineas)) {
                    foreach ($lineas as $linea) {
                        $linea = trim($linea);
                        if ($linea === '' || $linea[0] === '#' || strpos($linea, '=') === false) continue;
                        list($k, $v) = explode('=', $linea, 2);
                        $envArchivo[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
                    }
                }
                break;
            }
        }
    }
    $val = getenv($clave);
    if ($val !== false && $val !== '') return $val;
    if (isset($_ENV[$clave]) && $_ENV[$clave] !== '') return $_ENV[$clave];
    if (isset($envArchivo[$clave]) && $envArchivo[$clave] !== '') return $envArchivo[$clave];
    return $porDefecto;
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
    file_put_contents('/tmp/correo_debug.txt', "Iniciando envío de correo a: {$destinatario}\n", FILE_APPEND);

    try {
        $mail = new PHPMailer(true);

        $smtpHost = correo_env('SMTP_HOST', 'smtp.gmail.com');
        $smtpPort = intval(correo_env('SMTP_PORT', '587'));
        $smtpUser = correo_env('SMTP_USER', 'REMOVED_EMAIL');
        $smtpPass = correo_env('SMTP_PASS', 'REMOVED_SECRET');
        $smtpFrom = correo_env('SMTP_FROM', $smtpUser);
        $smtpFromName = correo_env('SMTP_FROM_NAME', 'Sistema de Pósteres');

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
        file_put_contents('/tmp/correo_debug.txt', "¡Correo enviado exitosamente a {$destinatario}!\n", FILE_APPEND);
        return true;
    } catch (Exception $e) {
        file_put_contents('/tmp/correo_debug.txt', "EXCEPCIÓN PHPMailer: " . $e->getMessage() . "\n", FILE_APPEND);
        return false;
    }
}

// Encola el correo en un proceso PHP en segundo plano para no bloquear
// la respuesta al cliente (el handshake SMTP con Gmail tarda 3-5s).
function encolarCorreoFondo($destinatario, $asunto, $mensajeHtml)
{
    $script = __DIR__ . '/EnviarCorreoFondo.php';
    $payload = base64_encode(json_encode([
        'destinatario' => $destinatario,
        'asunto' => $asunto,
        'mensaje' => correo_asegurar_plantilla($asunto, $mensajeHtml),
    ]));
    // Proceso separado: la petición actual termina de inmediato.
    exec('php ' . escapeshellarg($script) . ' ' . escapeshellarg($payload) . ' > /dev/null 2>&1 &');
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