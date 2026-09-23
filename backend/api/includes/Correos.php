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

function enviarCorreoNotificacion($destinatario, $asunto, $mensajeHtml)
{
    file_put_contents('/tmp/correo_debug.txt', "Iniciando envío de correo a: {$destinatario}\n", FILE_APPEND);

    try {
        $mail = new PHPMailer(true);

        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'REMOVED_EMAIL';
        $mail->Password = 'REMOVED_SECRET';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        // Evitar esperas largas: Gmail suele tardar 2-4s en el handshake TLS.
        $mail->Timeout = 10;
        $mail->Timelimit = 10;
        $mail->SMTPDebug = 0;

        $mail->setFrom('REMOVED_EMAIL', 'Sistema de Pósteres');
        $mail->addAddress($destinatario);

        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = $asunto;
        $mail->Body = $mensajeHtml;

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
        'mensaje' => $mensajeHtml,
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
?>