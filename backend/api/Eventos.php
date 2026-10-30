<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, PUT, DELETE, OPTIONS");

include_once '../Conexion.php';
include_once __DIR__ . '/includes/PostersHelper.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // -------------------------------------------------------------
    // 1. OBTENER EVENTOS (GET)
    // -------------------------------------------------------------
    case 'GET':
        $carreraFiltro = isset($_GET['carrera']) && trim((string)$_GET['carrera']) !== ''
            ? ph_normalizar_carrera($_GET['carrera'])
            : null;

        if (isset($_GET['activo']) && $_GET['activo'] == '1') {
            $resActivos = $conexion->query("SELECT * FROM eventos WHERE activo = 1 ORDER BY id_evento ASC");
            $eventosActivos = [];
            $porCarrera = ['sistemas' => null, 'civil' => null, 'ambas' => null];
            if ($resActivos) {
                while ($row = $resActivos->fetch_assoc()) {
                    $cEv = ph_normalizar_carrera($row['carrera'] ?? 'sistemas');
                    $row['carrera'] = $cEv;
                    $row['carrera_etiqueta'] = ph_etiqueta_carrera($cEv);
                    $eventosActivos[] = $row;
                    if ($porCarrera[$cEv] === null) {
                        $porCarrera[$cEv] = $row;
                    }
                    if ($cEv === 'ambas') {
                        if ($porCarrera['sistemas'] === null) $porCarrera['sistemas'] = $row;
                        if ($porCarrera['civil'] === null) $porCarrera['civil'] = $row;
                    }
                }
            }

            $eventoPrincipal = null;
            if ($carreraFiltro && isset($porCarrera[$carreraFiltro]) && $porCarrera[$carreraFiltro] !== null) {
                $eventoPrincipal = $porCarrera[$carreraFiltro];
            } else {
                $curr = auth_current();
                $idEvAdmin = auth_id_evento_admin($conexion, $curr);
                if ($idEvAdmin !== null) {
                    foreach ($eventosActivos as $evAct) {
                        if (intval($evAct['id_evento']) === $idEvAdmin) {
                            $eventoPrincipal = $evAct;
                            break;
                        }
                    }
                    if (!$eventoPrincipal) {
                        $stmtEvAdm = $conexion->prepare("SELECT * FROM eventos WHERE id_evento = ? LIMIT 1");
                        if ($stmtEvAdm) {
                            $stmtEvAdm->bind_param("i", $idEvAdmin);
                            $stmtEvAdm->execute();
                            if ($rowAdm = $stmtEvAdm->get_result()->fetch_assoc()) {
                                $cEv = ph_normalizar_carrera($rowAdm['carrera'] ?? 'sistemas');
                                $rowAdm['carrera'] = $cEv;
                                $rowAdm['carrera_etiqueta'] = ph_etiqueta_carrera($cEv);
                                $eventoPrincipal = $rowAdm;
                            }
                            $stmtEvAdm->close();
                        }
                    }
                }
                if (!$eventoPrincipal) {
                    $eventoPrincipal = $eventosActivos[0] ?? null;
                }
            }

            echo json_encode([
                "status" => "success",
                "success" => true,
                "data" => $eventoPrincipal,
                "eventos_activos" => $eventosActivos,
                "por_carrera" => $porCarrera,
            ]);
        } else {
            if ($carreraFiltro && in_array($carreraFiltro, ['sistemas', 'civil'], true)) {
                $stmt = $conexion->prepare("SELECT * FROM eventos WHERE carrera = ? OR carrera = 'ambas' ORDER BY activo DESC, id_evento DESC");
                $stmt->bind_param("s", $carreraFiltro);
                $stmt->execute();
                $res = $stmt->get_result();
            } else {
                $res = $conexion->query("SELECT * FROM eventos ORDER BY activo DESC, id_evento DESC");
            }
            $eventos = [];
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $cEv = ph_normalizar_carrera($row['carrera'] ?? 'sistemas');
                    $row['carrera'] = $cEv;
                    $row['carrera_etiqueta'] = ph_etiqueta_carrera($cEv);
                    $eventos[] = $row;
                }
            }
            if (isset($stmt)) $stmt->close();
            echo json_encode([
                "status" => "success",
                "success" => true,
                "data" => $eventos,
            ]);
        }
        break;

    // -------------------------------------------------------------
    // 2. CREAR UN NUEVO EVENTO (POST) — Solo Super Admin (rol 4)
    // -------------------------------------------------------------
    case 'POST':
        $auth = require_role([4]);
        $data = json_decode(file_get_contents("php://input"));

        if (!$data) {
            echo json_encode(["status" => "error", "success" => false, "message" => "Cuerpo de la petición JSON inválido."]);
            exit;
        }

        if (!empty($data->nombre_evento) && !empty($data->codigo_evento)) {
            $nombre = trim($data->nombre_evento);
            $codigo = trim($data->codigo_evento);
            $inicio = !empty($data->fecha_inicio) ? $data->fecha_inicio : null;
            $fin = !empty($data->fecha_fin) ? $data->fecha_fin : null;
            $carrera = !empty($data->carrera) ? ph_normalizar_carrera($data->carrera) : 'sistemas';

            $sql = "INSERT INTO eventos (nombre_evento, codigo_evento, carrera, fecha_inicio, fecha_fin, activo) VALUES (?, ?, ?, ?, ?, 0)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("sssss", $nombre, $codigo, $carrera, $inicio, $fin);

            if ($stmt->execute()) {
                $idNuevoEv = intval($conexion->insert_id);
                $stmt->close();

                // Crear Ronda 1 automáticamente para el nuevo evento con criterios base
                $nombreRonda1 = 'Ronda 1 · Evaluación inicial';
                $cuposR1 = (strpos(mb_strtolower((string)$carrera, 'UTF-8'), 'civil') !== false) ? 5 : 9;
                $stmtR = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, fecha_inicio, cupos_seleccion, premios, creado_por) VALUES (?, 1, ?, 'abierta', NOW(), ?, 3, ?)");
                if ($stmtR) {
                    $idCreador = intval($auth['id']);
                    $stmtR->bind_param("isii", $idNuevoEv, $nombreRonda1, $cuposR1, $idCreador);
                    if ($stmtR->execute()) {
                        $idRondaNueva = intval($conexion->insert_id);
                        rh_copiar_criterios($conexion, 1, $idRondaNueva);
                    }
                    $stmtR->close();
                }

                echo json_encode(["status" => "success", "success" => true, "message" => "Evento creado correctamente"]);
            } else {
                $err = $conexion->error;
                $stmt->close();
                echo json_encode(["status" => "error", "success" => false, "message" => "Error al crear evento: " . $err]);
            }
        } else {
            echo json_encode(["status" => "error", "success" => false, "message" => "Nombre y código del evento son obligatorios."]);
        }
        break;

    // -------------------------------------------------------------
    // 3. EDITAR / ACTIVAR EVENTO (PUT) — Solo Super Admin (rol 4)
    // -------------------------------------------------------------
    case 'PUT':
        $auth = require_role([4]);
        $data = json_decode(file_get_contents("php://input"));

        if (!$data) {
            echo json_encode(["status" => "error", "success" => false, "message" => "Cuerpo de la petición JSON inválido."]);
            exit;
        }

        // CASO A: Activar un evento específico (desactivando solo los de su misma carrera)
        if (isset($data->accion) && $data->accion === 'activar' && !empty($data->id_evento)) {
            $id_evento = intval($data->id_evento);

            $stmtEv = $conexion->prepare("SELECT carrera FROM eventos WHERE id_evento = ? LIMIT 1");
            $stmtEv->bind_param("i", $id_evento);
            $stmtEv->execute();
            $filaEv = $stmtEv->get_result()->fetch_assoc();
            $stmtEv->close();

            if (!$filaEv) {
                echo json_encode(["status" => "error", "success" => false, "message" => "El evento indicado no existe."]);
                exit;
            }
            $carreraEv = ph_normalizar_carrera($filaEv['carrera'] ?? 'sistemas');

            $conexion->begin_transaction();
            try {
                // Desactivar solo eventos de la misma carrera (así Sistemas y Civil pueden tener 1 evento activo cada una)
                $stmtDes = $conexion->prepare("UPDATE eventos SET activo = 0 WHERE carrera = ?");
                $stmtDes->bind_param("s", $carreraEv);
                $stmtDes->execute();
                $stmtDes->close();

                $stmtAct = $conexion->prepare("UPDATE eventos SET activo = 1 WHERE id_evento = ?");
                $stmtAct->bind_param("i", $id_evento);
                $stmtAct->execute();
                $stmtAct->close();

                // Actualizar automáticamente a los usuarios de esa carrera para que apunten al nuevo evento activo
                if ($carreraEv === 'civil') {
                    $stmtUsrEv = $conexion->prepare("UPDATE usuario SET id_evento = ? WHERE id_rol IN (1, 2, 3) AND LOWER(carrera) LIKE '%civil%'");
                    if ($stmtUsrEv) {
                        $stmtUsrEv->bind_param("i", $id_evento);
                        $stmtUsrEv->execute();
                        $stmtUsrEv->close();
                    }
                } elseif ($carreraEv === 'sistemas') {
                    $stmtUsrEv = $conexion->prepare("UPDATE usuario SET id_evento = ? WHERE id_rol IN (1, 2, 3) AND LOWER(carrera) NOT LIKE '%civil%'");
                    if ($stmtUsrEv) {
                        $stmtUsrEv->bind_param("i", $id_evento);
                        $stmtUsrEv->execute();
                        $stmtUsrEv->close();
                    }
                }

                // Asegurar que el evento tenga al menos Ronda 1 creada
                $stmtChkR = $conexion->prepare("SELECT id_ronda FROM rondas WHERE id_evento = ? LIMIT 1");
                $stmtChkR->bind_param("i", $id_evento);
                $stmtChkR->execute();
                $tieneRonda = (bool)$stmtChkR->get_result()->fetch_row();
                $stmtChkR->close();

                if (!$tieneRonda) {
                    $idCreador = intval($auth['id']);
                    $cuposR1 = (strpos(mb_strtolower((string)$carreraEv, 'UTF-8'), 'civil') !== false) ? 5 : 9;
                    $stmtR1 = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, fecha_inicio, cupos_seleccion, premios, creado_por) VALUES (?, 1, 'Ronda 1 · Evaluación inicial', 'abierta', NOW(), ?, 3, ?)");
                    if ($stmtR1) {
                        $stmtR1->bind_param("iii", $id_evento, $cuposR1, $idCreador);
                        if ($stmtR1->execute()) {
                            $idRondaNueva = intval($conexion->insert_id);
                            rh_copiar_criterios($conexion, 1, $idRondaNueva);
                        }
                        $stmtR1->close();
                    }
                }

                $conexion->commit();
                echo json_encode([
                    "status" => "success",
                    "success" => true,
                    "message" => "Evento activado correctamente para " . ph_etiqueta_carrera($carreraEv),
                ]);
            } catch (Exception $e) {
                error_log('Eventos activar: ' . $e->getMessage());
                $conexion->rollback();
                echo json_encode(["status" => "error", "success" => false, "message" => "No se pudo activar el evento."]);
            }
            exit;
        }

        // CASO B: Editar datos de un evento (Nombre, Código, Carrera, Fechas)
        if (!empty($data->id_evento) && !empty($data->nombre_evento) && !empty($data->codigo_evento)) {
            $id_evento = intval($data->id_evento);
            $nombre = trim($data->nombre_evento);
            $codigo = trim($data->codigo_evento);
            $inicio = !empty($data->fecha_inicio) ? $data->fecha_inicio : null;
            $fin = !empty($data->fecha_fin) ? $data->fecha_fin : null;
            $carrera = !empty($data->carrera) ? ph_normalizar_carrera($data->carrera) : 'sistemas';

            $sql = "UPDATE eventos SET nombre_evento = ?, codigo_evento = ?, carrera = ?, fecha_inicio = ?, fecha_fin = ? WHERE id_evento = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("sssssi", $nombre, $codigo, $carrera, $inicio, $fin, $id_evento);

            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "success" => true, "message" => "Evento actualizado correctamente"]);
            } else {
                error_log('Eventos actualizar: ' . $conexion->error);
                echo json_encode(["status" => "error", "success" => false, "message" => "No se pudo actualizar el evento."]);
            }
            $stmt->close();
        } else {
            echo json_encode(["status" => "error", "success" => false, "message" => "Datos incompletos para actualizar el evento."]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "success" => false, "message" => "Método HTTP no permitido"]);
        break;
}
?>