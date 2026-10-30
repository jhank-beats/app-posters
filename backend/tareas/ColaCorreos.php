<?php
// backend/tareas/ColaCorreos.php — drena la tabla cola_correos.
// Ejecutar por cron cada minuto:
//   * * * * * php /ruta/al/backend/tareas/ColaCorreos.php >> /tmp/cola_correos.log 2>&1

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Solo CLI\n");
}

// Candado exclusivo (flock) para evitar que múltiples instancias corran en paralelo
$lockFile = sys_get_temp_dir() . '/cola_correos.lock';
$lockFp = fopen($lockFile, 'c+');
if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
    // Otra instancia ya está ejecutándose y drenando la cola
    exit(0);
}

require_once __DIR__ . '/../api/includes/Auth.php';
require_once __DIR__ . '/../api/includes/Correos.php';
require_once __DIR__ . '/../Conexion.php';

// Si los correos están deshabilitados, salir de inmediato sin drenar
if (correos_estan_deshabilitados()) {
    flock($lockFp, LOCK_UN);
    fclose($lockFp);
    echo "[" . date('c') . "] cola_correos: envío de correos deshabilitado por configuración.\n";
    exit(0);
}

const LOTE = 25;
const MAX_INTENTOS = 5;

// Protección en servidor: Si existen correos en cola con más de 1 hora de antigüedad,
// se descartan automáticamente para evitar disparar correos acumulados durante pausas de servicio.
$conexion->query(
    "UPDATE cola_correos
     SET estado = 'error',
         ultimo_error = 'Descartado: correo antiguo acumulado en cola previo a la reactivación'
     WHERE estado = 'pendiente' AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)"
);

$res = $conexion->query(
    "SELECT id, destinatario, asunto, mensaje
     FROM cola_correos
     WHERE estado = 'pendiente' AND intentos < " . MAX_INTENTOS . "
     ORDER BY id ASC
     LIMIT " . LOTE
);

if (!$res) {
    fwrite(STDERR, "No se pudo leer cola_correos (¿ejecutaste BD/migracion_cola_correos.sql?)\n");
    flock($lockFp, LOCK_UN);
    fclose($lockFp);
    exit(1);
}

$procesados = 0;
while ($row = $res->fetch_assoc()) {
    $id = (int)$row['id'];

    // Marcar como 'enviando' temporalmente incrementando intento para evitar doble procesamiento
    $conexion->query("UPDATE cola_correos SET intentos = intentos + 1 WHERE id = {$id} AND estado = 'pendiente'");

    $ok = enviarCorreoNotificacion($row['destinatario'], $row['asunto'], $row['mensaje']);
    if ($ok) {
        $stmt = $conexion->prepare("UPDATE cola_correos SET estado='enviado', enviado_at=NOW() WHERE id=?");
    } else {
        $stmt = $conexion->prepare("UPDATE cola_correos SET estado = IF(intentos >= " . MAX_INTENTOS . ", 'error', 'pendiente'), ultimo_error='fallo SMTP' WHERE id=?");
    }
    if ($stmt) {
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();
    }
    $procesados++;
}

flock($lockFp, LOCK_UN);
fclose($lockFp);

echo "[" . date('c') . "] cola_correos: procesados {$procesados}\n";

