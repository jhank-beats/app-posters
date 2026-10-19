<?php
// backend/tareas/Recordatorios.php
// Script CLI para ejecutar los recordatorios y tareas programadas de la Fase 5.
// Uso:
//   php backend/tareas/Recordatorios.php            (evalúa horarios activos en recordatorios_config)
//   php backend/tareas/Recordatorios.php cron       (evalúa horarios activos en recordatorios_config)
//   php backend/tareas/Recordatorios.php recordatorio
//   php backend/tareas/Recordatorios.php asignar
//   php backend/tareas/Recordatorios.php reasignar
//   php backend/tareas/Recordatorios.php informe

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Este script solo puede ejecutarse desde CLI.\n");
}

require_once __DIR__ . '/../Conexion.php';
require_once __DIR__ . '/../api/includes/RecordatoriosHelper.php';

rec_asegurar_tablas($conexion);

$accion = isset($argv[1]) ? strtolower(trim($argv[1])) : 'cron';

switch ($accion) {
    case 'cron':
        $disparados = rec_verificar_y_disparar_programados($conexion, true);
        if (empty($disparados)) {
            echo "[" . date('Y-m-d H:i:s') . "] Sin horarios pendientes por ejecutar en este momento.\n";
        } else {
            foreach ($disparados as $r) {
                echo "[" . date('Y-m-d H:i:s') . "] " . ($r['message'] ?? 'Ejecutado') . "\n";
            }
        }
        break;

    case 'recordatorio':
        // Usar el mensaje configurado del horario más cercano o el predeterminado
        $asunto = 'Recordatorio de evaluación de pósters';
        $mensaje = 'Te recordamos revisar y calificar los pósters que tienes pendientes en la ronda actual.';
        $resCfg = $conexion->query("SELECT asunto, mensaje_personalizado FROM recordatorios_config WHERE accion = 'recordatorio' AND activo = 1 ORDER BY ABS(TIME_TO_SEC(TIMEDIFF(STR_TO_DATE(hora, '%H:%i'), CURTIME()))) ASC LIMIT 1");
        if ($resCfg && $filaCfg = $resCfg->fetch_assoc()) {
            $asunto = $filaCfg['asunto'];
            $mensaje = $filaCfg['mensaje_personalizado'];
        }
        $r = rec_ejecutar_recordatorio($conexion, [
            'hora' => date('H:i'),
            'asunto' => $asunto,
            'mensaje_personalizado' => $mensaje,
            'ejecutado_por' => 'cli',
            'sincrono' => true,
        ]);
        echo "[" . date('Y-m-d H:i:s') . "] " . $r['message'] . "\n";
        break;

    case 'asignar':
        $r = rec_ejecutar_asignar_huerfanos($conexion, 'cli', true);
        echo "[" . date('Y-m-d H:i:s') . "] " . $r['message'] . "\n";
        break;

    case 'reasignar':
        $r = rec_ejecutar_reasignar_pendientes($conexion, 'cli', true);
        echo "[" . date('Y-m-d H:i:s') . "] " . $r['message'] . "\n";
        break;

    case 'informe':
        $r = rec_generar_informe($conexion, true, 'cli');
        echo "[" . date('Y-m-d H:i:s') . "] " . $r['detalle'] . "\n";
        break;

    default:
        fwrite(STDERR, "Acción desconocida '{$accion}'. Usa: cron | recordatorio | asignar | reasignar | informe\n");
        exit(1);
}
?>
