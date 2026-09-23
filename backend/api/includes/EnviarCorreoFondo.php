<?php
// Se ejecuta en segundo plano: php EnviarCorreoFondo.php <payload_base64>
// No debe imprimir nada ni bloquear al cliente.
$payload = $argv[1] ?? '';
$data = json_decode(base64_decode($payload), true);
if (!is_array($data) || empty($data['destinatario'])) {
    exit(1);
}

require_once __DIR__ . '/Correos.php';

enviarCorreoNotificacion($data['destinatario'], $data['asunto'], $data['mensaje']);
