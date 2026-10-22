<?php
// backend/tareas/ColaCorreos.php — drena la tabla cola_correos.
// Ejecutar por cron cada minuto:
//   * * * * * php /ruta/al/backend/tareas/ColaCorreos.php >> /tmp/cola_correos.log 2>&1

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Solo CLI\n");
}

require_once __DIR__ . '/../api/includes/Auth.php';
require_once __DIR__ . '/../api/includes/Correos.php';
require_once __DIR__ . '/../Conexion.php';

const LOTE = 20;
const MAX_INTENTOS = 5;

$res = $conexion->query(
    "SELECT id, destinatario, asunto, mensaje
     FROM cola_correos
     WHERE estado = 'pendiente' AND intentos < " . MAX_INTENTOS . "
     ORDER BY id ASC
     LIMIT " . LOTE
);

if (!$res) {
    fwrite(STDERR, "No se pudo leer cola_correos (¿ejecutaste BD/migracion_cola_correos.sql?)\n");
    exit(1);
}

$procesados = 0;
while ($row = $res->fetch_assoc()) {
    $id = (int)$row['id'];
    $ok = enviarCorreoNotificacion($row['destinatario'], $row['asunto'], $row['mensaje']);
    if ($ok) {
        $stmt = $conexion->prepare("UPDATE cola_correos SET estado='enviado', enviado_at=NOW() WHERE id=?");
    } else {
        $stmt = $conexion->prepare("UPDATE cola_correos SET intentos=intentos+1, ultimo_error='fallo SMTP' WHERE id=?");
    }
    if ($stmt) {
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();
    }
    $procesados++;
}

echo "[" . date('c') . "] cola_correos: procesados {$procesados}\n";
