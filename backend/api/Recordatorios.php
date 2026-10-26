<?php
// backend/api/Recordatorios.php
// API para gestionar horarios y mensajes de recordatorios (Fase 5) por Admin y Super Admin,
// verificar pendientes antes de enviar y ejecutar recordatorios o tareas programadas.

include_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, PUT, DELETE, OPTIONS");

include_once '../Conexion.php';
include_once __DIR__ . '/includes/RecordatoriosHelper.php';

$auth = require_role([3, 4]);
$idUsuarioActual = intval($auth['id']);
$rolActual = intval($auth['rol']);
$idEventoAdmin = auth_id_evento_admin($conexion, $auth);
$carreraScope = rec_resolver_carrera_actor($conexion, $auth); // 'civil' para Admin Civil, 'sistemas' para Super Admin y Admin Sistemas
$etiquetaActor = ($rolActual === 4) ? "super_admin:#{$idUsuarioActual}" : "admin:#{$idUsuarioActual}";

rec_asegurar_tablas($conexion);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Opcionalmente disparar horarios vencidos de esta carrera si se pasa ?auto_check=1
        if (!empty($_GET['auto_check'])) {
            rec_verificar_y_disparar_programados($conexion, true, $carreraScope);
        }

        // 1. Obtener horarios configurados para esta carrera y si ya se ejecutaron hoy
        $sqlCfg = "SELECT c.*,
                          (SELECT COUNT(*) FROM recordatorios_log l
                            WHERE l.id_config = c.id_config AND l.fecha = CURDATE()) AS ejecutado_hoy,
                          (SELECT l2.detalle FROM recordatorios_log l2
                            WHERE l2.id_config = c.id_config
                            ORDER BY l2.id_log DESC LIMIT 1) AS ultimo_detalle,
                          (SELECT l3.ejecutado_en FROM recordatorios_log l3
                            WHERE l3.id_config = c.id_config
                            ORDER BY l3.id_log DESC LIMIT 1) AS ultima_ejecucion
                   FROM recordatorios_config c
                   WHERE c.carrera = ?
                   ORDER BY c.hora ASC, c.id_config ASC";
        $stmtCfg = $conexion->prepare($sqlCfg);
        $horarios = [];
        if ($stmtCfg) {
            $stmtCfg->bind_param("s", $carreraScope);
            $stmtCfg->execute();
            $resCfg = $stmtCfg->get_result();
            if ($resCfg) {
                while ($row = $resCfg->fetch_assoc()) {
                    $row['id_config'] = intval($row['id_config']);
                    $row['activo'] = intval($row['activo']);
                    $row['ejecutado_hoy'] = intval($row['ejecutado_hoy']) > 0;
                    $horarios[] = $row;
                }
            }
            $stmtCfg->close();
        }

        // 2. Estado actual de pósters pendientes e informe (filtrado estrictamente por carrera: Sistemas para SuperAdmin/AdminSistemas, Civil para AdminCivil)
        $informe = rec_generar_informe($conexion, false, 'sistema', $idEventoAdmin, $carreraScope);

        // 3. Historial reciente de ejecuciones de esta carrera
        $sqlHist = "SELECT id_log, id_config, carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por, ejecutado_en
                    FROM recordatorios_log
                    WHERE carrera = ?
                    ORDER BY id_log DESC
                    LIMIT 20";
        $stmtHist = $conexion->prepare($sqlHist);
        $historial = [];
        if ($stmtHist) {
            $stmtHist->bind_param("s", $carreraScope);
            $stmtHist->execute();
            $resHist = $stmtHist->get_result();
            if ($resHist) {
                while ($row = $resHist->fetch_assoc()) {
                    $row['id_log'] = intval($row['id_log']);
                    $row['enviados'] = intval($row['enviados']);
                    $historial[] = $row;
                }
            }
            $stmtHist->close();
        }

        echo json_encode([
            'status' => 'success',
            'success' => true,
            'carrera' => $carreraScope,
            'hora_servidor' => date('H:i'),
            'fecha_servidor' => date('Y-m-d'),
            'horarios' => $horarios,
            'informe' => $informe,
            'historial' => $historial,
        ]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) $data = [];

        $operacion = $data['operacion'] ?? 'crear';

        // A) EJECUTAR AHORA (recordatorio manual o de un horario específico, o acciones asignar/reasignar/informe)
        if ($operacion === 'ejecutar') {
            $tipoAccion = $data['accion'] ?? 'recordatorio';
            $idConfig = isset($data['id_config']) && $data['id_config'] !== '' ? intval($data['id_config']) : null;
            $asunto = trim((string)($data['asunto'] ?? ''));
            $mensaje = trim((string)($data['mensaje_personalizado'] ?? ''));
            $horaLabel = date('H:i');

            if ($idConfig) {
                $stmtC = $conexion->prepare("SELECT * FROM recordatorios_config WHERE id_config = ? AND carrera = ?");
                $stmtC->bind_param("is", $idConfig, $carreraScope);
                $stmtC->execute();
                $cfgRow = $stmtC->get_result()->fetch_assoc();
                $stmtC->close();
                if ($cfgRow) {
                    $tipoAccion = $cfgRow['accion'] ?: 'recordatorio';
                    if ($asunto === '') $asunto = $cfgRow['asunto'];
                    if ($mensaje === '') $mensaje = $cfgRow['mensaje_personalizado'];
                    $horaLabel = $cfgRow['hora'];
                }
            }

            if ($tipoAccion === 'asignar') {
                $res = rec_ejecutar_asignar_huerfanos($conexion, $etiquetaActor, false, $idEventoAdmin, $carreraScope);
                $lote = $res['lote_correos'] ?? [];
                unset($res['lote_correos']);
                $res['success'] = true;
                responderJsonYNotificarLote($res, $lote);
                exit;
            } elseif ($tipoAccion === 'reasignar') {
                $res = rec_ejecutar_reasignar_pendientes($conexion, $etiquetaActor, false, $idEventoAdmin, $carreraScope);
                $lote = $res['lote_correos'] ?? [];
                unset($res['lote_correos']);
                $res['success'] = true;
                responderJsonYNotificarLote($res, $lote);
                exit;
            } elseif ($tipoAccion === 'informe') {
                $inf = rec_generar_informe($conexion, true, $etiquetaActor, $idEventoAdmin, $carreraScope);
                echo json_encode([
                    'status' => 'success',
                    'success' => true,
                    'message' => $inf['detalle'],
                    'informe' => $inf,
                ]);
                exit;
            } else {
                $res = rec_ejecutar_recordatorio($conexion, [
                    'id_config' => $idConfig,
                    'hora' => $horaLabel,
                    'asunto' => $asunto !== '' ? $asunto : 'Recordatorio de evaluación de pósters',
                    'mensaje_personalizado' => $mensaje !== '' ? $mensaje : 'Te recordamos revisar y calificar los pósters que tienes pendientes en la ronda actual.',
                    'ejecutado_por' => $etiquetaActor,
                    'sincrono' => false,
                    'id_evento' => $idEventoAdmin,
                    'carrera' => $carreraScope,
                ]);
                $lote = $res['lote_correos'] ?? [];
                unset($res['lote_correos']);
                $res['success'] = true;
                responderJsonYNotificarLote($res, $lote);
                exit;
            }
        }

        // B) CREAR UN NUEVO HORARIO DE RECORDATORIO (asociado a la carrera del actor)
        $horaNorm = rec_normalizar_hora($data['hora'] ?? '');
        if (!$horaNorm) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'La hora debe tener el formato HH:MM (ej. 08:30).']);
            exit;
        }

        $accionesValidas = ['recordatorio', 'asignar', 'reasignar', 'informe'];
        $accion = in_array($data['accion'] ?? 'recordatorio', $accionesValidas, true) ? $data['accion'] : 'recordatorio';
        $asunto = trim((string)($data['asunto'] ?? 'Recordatorio de evaluación de pósters'));
        if ($asunto === '') $asunto = 'Recordatorio de evaluación de pósters';
        $mensaje = trim((string)($data['mensaje_personalizado'] ?? ''));
        if ($mensaje === '') {
            $mensaje = 'Te recordamos revisar y calificar los pósters que tienes asignados en la jornada actual.';
        }
        $activo = isset($data['activo']) ? (intval($data['activo']) ? 1 : 0) : 1;

        $stmt = $conexion->prepare(
            "INSERT INTO recordatorios_config (carrera, hora, accion, asunto, mensaje_personalizado, activo)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("sssssi", $carreraScope, $horaNorm, $accion, $asunto, $mensaje, $activo);
        if ($stmt->execute()) {
            $nuevoId = $stmt->insert_id;
            $stmt->close();
            echo json_encode([
                'status' => 'success',
                'success' => true,
                'id_config' => $nuevoId,
                'carrera' => $carreraScope,
                'message' => "Horario de recordatorio ({$horaNorm}) agregado correctamente.",
            ]);
        } else {
            $err = $conexion->error;
            $stmt->close();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Error al guardar el horario: ' . $err]);
        }
        break;

    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data) || empty($data['id_config'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Falta el identificador del recordatorio (id_config).']);
            exit;
        }

        $idConfig = intval($data['id_config']);

        // Si solo se cambia activo (toggle rápido)
        if (isset($data['solo_estado']) && $data['solo_estado']) {
            $activo = intval($data['activo']) ? 1 : 0;
            $stmt = $conexion->prepare("UPDATE recordatorios_config SET activo = ? WHERE id_config = ? AND carrera = ?");
            $stmt->bind_param("iis", $activo, $idConfig, $carreraScope);
            $stmt->execute();
            $stmt->close();
            echo json_encode([
                'status' => 'success',
                'success' => true,
                'message' => $activo ? 'Recordatorio activado.' : 'Recordatorio pausado.',
            ]);
            exit;
        }

        $horaNorm = rec_normalizar_hora($data['hora'] ?? '');
        if (!$horaNorm) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'La hora debe tener el formato HH:MM (ej. 08:30).']);
            exit;
        }

        $accionesValidas = ['recordatorio', 'asignar', 'reasignar', 'informe'];
        $accion = in_array($data['accion'] ?? 'recordatorio', $accionesValidas, true) ? $data['accion'] : 'recordatorio';
        $asunto = trim((string)($data['asunto'] ?? 'Recordatorio de evaluación de pósters'));
        if ($asunto === '') $asunto = 'Recordatorio de evaluación de pósters';
        $mensaje = trim((string)($data['mensaje_personalizado'] ?? ''));
        if ($mensaje === '') {
            $mensaje = 'Te recordamos revisar y calificar los pósters que tienes asignados en la jornada actual.';
        }
        $activo = isset($data['activo']) ? (intval($data['activo']) ? 1 : 0) : 1;

        $stmt = $conexion->prepare(
            "UPDATE recordatorios_config
             SET hora = ?, accion = ?, asunto = ?, mensaje_personalizado = ?, activo = ?
             WHERE id_config = ? AND carrera = ?"
        );
        $stmt->bind_param("ssssiis", $horaNorm, $accion, $asunto, $mensaje, $activo, $idConfig, $carreraScope);
        if ($stmt->execute()) {
            $stmt->close();
            // Si la nueva hora es posterior a la hora actual o se pidió reprogramar hoy, limpiar el bloqueo de hoy para ese id_config
            if (!empty($data['reprogramar_hoy']) || $horaNorm > date('H:i')) {
                $stmtDelLog = $conexion->prepare("DELETE FROM recordatorios_log WHERE id_config = ? AND fecha = CURDATE()");
                if ($stmtDelLog) {
                    $stmtDelLog->bind_param("i", $idConfig);
                    $stmtDelLog->execute();
                    $stmtDelLog->close();
                }
            }
            echo json_encode([
                'status' => 'success',
                'success' => true,
                'message' => "Recordatorio de las {$horaNorm} actualizado correctamente.",
            ]);
        } else {
            $err = $conexion->error;
            $stmt->close();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Error al actualizar el recordatorio: ' . $err]);
        }
        break;

    case 'DELETE':
        $idConfig = isset($_GET['id_config']) ? intval($_GET['id_config']) : 0;
        if (!$idConfig) {
            $data = json_decode(file_get_contents('php://input'), true);
            if (is_array($data) && !empty($data['id_config'])) {
                $idConfig = intval($data['id_config']);
            }
        }

        if ($idConfig <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Falta el ID del horario a eliminar.']);
            exit;
        }

        $stmt = $conexion->prepare("DELETE FROM recordatorios_config WHERE id_config = ? AND carrera = ?");
        $stmt->bind_param("is", $idConfig, $carreraScope);
        if ($stmt->execute()) {
            $afectadas = $stmt->affected_rows;
            $stmt->close();
            if ($afectadas === 0) {
                http_response_code(403);
                echo json_encode([
                    'status' => 'error',
                    'success' => false,
                    'message' => 'No tienes permiso para eliminar este horario o no existe en tu carrera.',
                ]);
                exit;
            }
            echo json_encode([
                'status' => 'success',
                'success' => true,
                'message' => 'Horario de recordatorio eliminado correctamente.',
            ]);
        } else {
            $err = $conexion->error;
            $stmt->close();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Error al eliminar el horario: ' . $err]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Método no permitido.']);
        break;
}
?>
