<?php
/**
 * scripts/limpiar_cola_correos.php
 *
 * Utilidad para el servidor (producción o desarrollo).
 * Cancela y purga todos los correos que hayan quedado en estado 'pendiente'
 * en la tabla cola_correos para garantizar que NINGÚN correo viejo sea enviado.
 *
 * Uso en el servidor:
 *   php scripts/limpiar_cola_correos.php
 */

require_once __DIR__ . '/../backend/Conexion.php';

echo "\n" . str_repeat('=', 65) . "\n";
echo "  PURGA Y LIMPIEZA DE COLA DE CORREOS (cola_correos)\n";
echo str_repeat('=', 65) . "\n";

if (!isset($conexion) || $conexion->connect_error) {
    fwrite(STDERR, "Error: No se pudo conectar a la base de datos.\n");
    exit(1);
}

// 1. Contar correos pendientes
$resPend = $conexion->query("SELECT COUNT(*) AS total FROM cola_correos WHERE estado = 'pendiente'");
$totalPendientes = $resPend ? intval($resPend->fetch_assoc()['total']) : 0;

echo "Correos con estado 'pendiente' encontrados: {$totalPendientes}\n";

if ($totalPendientes > 0) {
    // 2. Marcar todos los pendientes como cancelados/error
    $stmt = $conexion->prepare(
        "UPDATE cola_correos
         SET estado = 'error',
             ultimo_error = 'Cancelado: correo antiguo descartado al reactivar el servicio'
         WHERE estado = 'pendiente'"
    );
    $stmt->execute();
    $afectados = $stmt->affected_rows;
    $stmt->close();

    echo "✔ Se descartaron exitosamente {$afectados} correos pendientes.\n";
    echo "✔ NINGUNO de estos correos viejos será enviado por el servidor.\n";
} else {
    echo "✔ La cola ya estaba completamente limpia (0 correos pendientes).\n";
}

// 3. Resumen de la tabla
echo "\nResumen actual de cola_correos:\n";
$resResumen = $conexion->query("SELECT estado, COUNT(*) AS cantidad FROM cola_correos GROUP BY estado");
if ($resResumen) {
    while ($fila = $resResumen->fetch_assoc()) {
        echo "  - Estado '{$fila['estado']}': {$fila['cantidad']}\n";
    }
}

echo str_repeat('=', 65) . "\n";
echo "Estado: SEGURO. Los envíos nuevos que se generen a partir de ahora\n";
echo "se procesarán en tiempo real sin acumulación de correos pasados.\n";
echo str_repeat('=', 65) . "\n\n";
