<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, PUT, DELETE, OPTIONS");

// Incluir el archivo de conexión existente
include_once '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/RondasHelper.php';
include_once __DIR__ . '/includes/PostersHelper.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // 1. OBTENER ESPACIOS Y PÓSTERES ASIGNADOS POR EVENTO
    case 'GET':
        $authCurr = auth_current();
        $id_evento_admin = auth_id_evento_admin($conexion, $authCurr);
        $id_evento = isset($_GET['id_evento']) ? intval($_GET['id_evento']) : null;
        $carrera = isset($_GET['carrera']) ? trim((string)$_GET['carrera']) : null;

        // Si quien consulta es un Admin (rol 3), SIEMPRE filtra por su evento asignado
        if ($id_evento_admin !== null) {
            $id_evento = $id_evento_admin;
        } elseif (!$id_evento && $carrera !== null && $carrera !== '') {
            $id_evento = ph_evento_activo($conexion, $carrera);
        }

        if ($id_evento && $id_evento > 0) {
            $sql = "SELECT e.*, ev.nombre_evento, ev.codigo_evento, COALESCE(ev.carrera, 'sistemas') AS carrera_evento,
                           COUNT(p.id) AS ocupacion_actual 
                    FROM espacios_fisicos e 
                    LEFT JOIN eventos ev ON ev.id_evento = e.id_evento
                    LEFT JOIN cargar_posters p ON e.id_espacio = p.id_espacio AND p.activo = 1
                    WHERE e.id_evento = ?
                    GROUP BY e.id_espacio
                    ORDER BY e.id_espacio ASC";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("i", $id_evento);
            $stmt->execute();
            $resultado = $stmt->get_result();
        } else {
            // Super Admin o visitante público sin filtro específico: muestra los espacios de todos los eventos activos
            $sql = "SELECT e.*, ev.nombre_evento, ev.codigo_evento, COALESCE(ev.carrera, 'sistemas') AS carrera_evento,
                           COUNT(p.id) AS ocupacion_actual 
                    FROM espacios_fisicos e 
                    INNER JOIN eventos ev ON ev.id_evento = e.id_evento AND ev.activo = 1
                    LEFT JOIN cargar_posters p ON e.id_espacio = p.id_espacio AND p.activo = 1
                    GROUP BY e.id_espacio
                    ORDER BY ev.id_evento ASC, e.id_espacio ASC";
            $stmt = $conexion->prepare($sql);
            $stmt->execute();
            $resultado = $stmt->get_result();
        }

        $espacios = [];
        while ($row = $resultado->fetch_assoc()) {
            $espacios[] = $row;
        }

        echo json_encode(["status" => "success", "data" => $espacios]);
        $stmt->close();
        break;

    // 2. CREAR UN NUEVO ESPACIO FÍSICO
    case 'POST':
        $auth = require_role([3, 4]);
        $id_evento_admin = auth_id_evento_admin($conexion, $auth);
        $data = json_decode(file_get_contents("php://input"));

        if (!empty($data->nombre_espacio) && !empty($data->capacidad)) {
            $nombre = trim($data->nombre_espacio);
            $ubicacion = isset($data->ubicacion_detallada) ? trim($data->ubicacion_detallada) : '';
            $capacidad = intval($data->capacidad);

            // Si es Admin (rol 3), se asigna obligatoriamente a su evento; Super Admin puede elegir el evento
            if ($id_evento_admin !== null) {
                $id_evento = $id_evento_admin;
            } else {
                $id_evento = !empty($data->id_evento)
                    ? intval($data->id_evento)
                    : ph_evento_activo($conexion, $data->carrera ?? null);
            }

            $sql = "INSERT INTO espacios_fisicos (nombre_espacio, ubicacion_detallada, capacidad, id_evento) VALUES (?, ?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssii", $nombre, $ubicacion, $capacidad, $id_evento);

            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Espacio creado correctamente"]);
            } else {
                error_log('Espacios guardar: ' . $conexion->error);
                echo json_encode(["status" => "error", "message" => "No se pudo guardar el espacio."]);
            }
            $stmt->close();
        } else {
            echo json_encode(["status" => "error", "message" => "Datos incompletos"]);
        }
        break;

    // 3. ASIGNAR ESPACIO A UN PÓSTER o EDITAR ESPACIO (accion=editar_espacio)
    case 'PUT':
        $auth = require_role([3, 4]);
        $data = json_decode(file_get_contents("php://input"));
        $accion = isset($data->accion) ? trim((string)$data->accion) : '';

        if ($accion === 'editar_espacio' || (isset($data->id_espacio) && !isset($data->id_poster) && $accion !== 'asignar_poster')) {
            editar_espacio($conexion, $auth, $data);
            exit;
        }

        if (isset($data->id_poster)) {
            $id_poster = intval($data->id_poster);
            $id_espacio = (isset($data->id_espacio) && $data->id_espacio !== null && $data->id_espacio !== "")
                ? intval($data->id_espacio)
                : null;

            // Leer ubicación anterior ANTES de hacer el UPDATE
            $ubiAntes = rh_ubicacion_poster($conexion, $id_poster);
            $id_espacio_anterior = $ubiAntes['id_espacio'];
            $espacio_anterior_txt = $ubiAntes['id_espacio'] !== null ? $ubiAntes['etiqueta'] : null;

            // Si no hay cambio real de espacio, responder de inmediato sin reenviar correos
            if ($id_espacio_anterior === $id_espacio) {
                echo json_encode(["status" => "success", "message" => "La ubicación ya estaba asignada"]);
                exit;
            }

            // Si se va a asignar a un espacio (no desasignar)
            if ($id_espacio !== null) {
                // Consultar capacidad y ocupación actual ignorando el póster que se edita
                $sqlCap = "SELECT e.capacidad, COUNT(p.id) AS ocupados 
                           FROM espacios_fisicos e 
                           LEFT JOIN cargar_posters p ON e.id_espacio = p.id_espacio AND p.activo = 1 AND p.id != ?
                           WHERE e.id_espacio = ?
                           GROUP BY e.id_espacio";

                $stmtCap = $conexion->prepare($sqlCap);
                $stmtCap->bind_param("ii", $id_poster, $id_espacio);
                $stmtCap->execute();
                $resCap = $stmtCap->get_result();

                if ($info = $resCap->fetch_assoc()) {
                    if ($info['ocupados'] >= $info['capacidad']) {
                        echo json_encode([
                            "status" => "error",
                            "message" => "El espacio seleccionado alcanzó su capacidad máxima (" . $info['capacidad'] . " pósteres)."
                        ]);
                        $stmtCap->close();
                        exit;
                    }
                }
                $stmtCap->close();
            }

            // Actualizar la columna id_espacio en cargar_posters
            if ($id_espacio === null) {
                $sqlAsignar = "UPDATE cargar_posters SET id_espacio = NULL WHERE id = ?";
                $stmtAsignar = $conexion->prepare($sqlAsignar);
                $stmtAsignar->bind_param("i", $id_poster);
            } else {
                $sqlAsignar = "UPDATE cargar_posters SET id_espacio = ? WHERE id = ?";
                $stmtAsignar = $conexion->prepare($sqlAsignar);
                $stmtAsignar->bind_param("ii", $id_espacio, $id_poster);
            }

            if ($stmtAsignar->execute()) {
                $stmtAsignar->close();

                // Leer nueva ubicación y número tras el UPDATE
                $ubiDespues = rh_ubicacion_poster($conexion, $id_poster);
                $espacio_nuevo_txt = $ubiDespues['id_espacio'] !== null ? $ubiDespues['etiqueta'] : 'sin ubicar';
                $esCambioDeEspacio = ($id_espacio_anterior !== null && $id_espacio !== null && $id_espacio_anterior !== $id_espacio);

                // Registrar en cambios_espacio_log cuando se reubica o se asigna espacio
                if ($id_espacio !== null && $id_espacio_anterior !== $id_espacio) {
                    rh_asegurar_tabla_cambios_espacio($conexion);
                    $stmtLog = $conexion->prepare(
                        "INSERT INTO cambios_espacio_log (id_poster, id_espacio_anterior, espacio_anterior, id_espacio_nuevo, espacio_nuevo, numero_nuevo)
                         VALUES (?, ?, ?, ?, ?, ?)"
                    );
                    if ($stmtLog) {
                        $numNuevo = $ubiDespues['numero'];
                        $stmtLog->bind_param(
                            "iisisi",
                            $id_poster,
                            $id_espacio_anterior,
                            $espacio_anterior_txt,
                            $id_espacio,
                            $ubiDespues['nombre_espacio'],
                            $numNuevo
                        );
                        $stmtLog->execute();
                        $stmtLog->close();
                    }
                }

                // Preparar lote de correos (autor + evaluadores asignados si aplica)
                $loteCorreos = [];
                $sqlAut = "SELECT p.titulo, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor
                           FROM cargar_posters p
                           JOIN usuario u ON p.id_usuario = u.id
                           WHERE p.id = ?";
                $stmtAut = $conexion->prepare($sqlAut);
                $stmtAut->bind_param("i", $id_poster);
                $stmtAut->execute();
                $resAut = $stmtAut->get_result();
                $tituloPoster = 'Póster';

                if ($rowAut = $resAut->fetch_assoc()) {
                    $tituloPoster = $rowAut['titulo'];
                    $destAutor = $rowAut['correo'];
                    $nomAutor = rh_escapar($rowAut['nombre_autor']);
                    $titEsc = rh_escapar($tituloPoster);

                    if ($id_espacio === null) {
                        $asuntoEsp = "Espacio liberado para tu póster";
                        $cuerpoAutor = "<p>Hola, <strong>{$nomAutor}</strong>.</p>"
                            . "<p>Tu póster <strong>&laquo;{$titEsc}&raquo;</strong> fue desasignado de su espacio físico"
                            . ($espacio_anterior_txt ? " (anteriormente en <strong>" . rh_escapar($espacio_anterior_txt) . "</strong>)" : "")
                            . ". Te notificaremos cuando tenga una nueva ubicación.</p>";
                    } elseif ($esCambioDeEspacio) {
                        $asuntoEsp = "Cambio de espacio físico para tu póster";
                        $cuerpoAutor = "<p>Hola, <strong>{$nomAutor}</strong>.</p>"
                            . "<p>Tu póster <strong>&laquo;{$titEsc}&raquo;</strong> cambió del espacio <strong>"
                            . rh_escapar($espacio_anterior_txt) . "</strong> al espacio <strong>"
                            . rh_escapar($espacio_nuevo_txt) . "</strong>.</p>";
                    } else {
                        $asuntoEsp = "Espacio asignado a tu póster";
                        $cuerpoAutor = "<p>Hola, <strong>{$nomAutor}</strong>.</p>"
                            . "<p>Tu póster <strong>&laquo;{$titEsc}&raquo;</strong> fue ubicado en <strong>"
                            . rh_escapar($espacio_nuevo_txt) . "</strong>.</p>";
                    }

                    if (!empty($destAutor)) {
                        $loteCorreos[] = [
                            'correo' => $destAutor,
                            'asunto' => $asuntoEsp,
                            'cuerpo' => rh_plantilla_correo($asuntoEsp, $cuerpoAutor),
                        ];
                    }
                }
                $stmtAut->close();

                // Notificar a los evaluadores asignados cuando el póster cambia o recibe un espacio físico
                if ($id_espacio !== null) {
                    $sqlEvals = "SELECT DISTINCT u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_eval
                                 FROM asignaciones_evaluadores a
                                 JOIN usuario u ON u.id = a.id_evaluador
                                 WHERE a.id_poster = ? AND u.activo = 1";
                    $stmtEv = $conexion->prepare($sqlEvals);
                    if ($stmtEv) {
                        $stmtEv->bind_param("i", $id_poster);
                        $stmtEv->execute();
                        $resEv = $stmtEv->get_result();
                        $titEsc = rh_escapar($tituloPoster);

                        while ($rowEv = $resEv->fetch_assoc()) {
                            if (empty($rowEv['correo'])) continue;
                            $nomEval = rh_escapar($rowEv['nombre_eval']);
                            if ($esCambioDeEspacio) {
                                $asuntoEv = "Cambio de ubicación de póster asignado";
                                $cuerpoEv = "<p>Hola, <strong>{$nomEval}</strong>.</p>"
                                    . "<p>El póster <strong>&laquo;{$titEsc}&raquo;</strong> que tienes asignado para evaluar cambió del espacio <strong>"
                                    . rh_escapar($espacio_anterior_txt) . "</strong> al espacio <strong>"
                                    . rh_escapar($espacio_nuevo_txt) . "</strong>.</p>";
                            } else {
                                $asuntoEv = "Ubicación asignada a póster por evaluar";
                                $cuerpoEv = "<p>Hola, <strong>{$nomEval}</strong>.</p>"
                                    . "<p>El póster <strong>&laquo;{$titEsc}&raquo;</strong> que tienes asignado para evaluar fue ubicado en <strong>"
                                    . rh_escapar($espacio_nuevo_txt) . "</strong>.</p>";
                            }
                            $loteCorreos[] = [
                                'correo' => $rowEv['correo'],
                                'asunto' => $asuntoEv,
                                'cuerpo' => rh_plantilla_correo($asuntoEv, $cuerpoEv),
                            ];
                        }
                        $stmtEv->close();
                    }
                }

                // Responder primero, enviar lote de correos después (no bloquea la UI)
                responderJsonYNotificarLote(
                    [
                        "status" => "success",
                        "message" => $esCambioDeEspacio
                            ? "Ubicación actualizada a {$espacio_nuevo_txt}"
                            : "Ubicación asignada correctamente",
                        "ubicacion" => $ubiDespues,
                    ],
                    $loteCorreos
                );
                exit;
            } else {
                error_log('Espacios ubicación: ' . $conexion->error);
                $errMsg = "No se pudo actualizar la ubicación.";
                $stmtAsignar->close();
                echo json_encode(["status" => "error", "message" => $errMsg]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Falta el ID del póster"]);
        }
        break;

    // 4. ELIMINAR ESPACIO FÍSICO
    case 'DELETE':
        $auth = require_role([3, 4]);
        $idEsp = isset($_GET['id_espacio']) ? intval($_GET['id_espacio']) : 0;
        if ($idEsp <= 0) {
            $raw = file_get_contents('php://input');
            $j = json_decode($raw, true);
            if (is_array($j) && !empty($j['id_espacio'])) {
                $idEsp = intval($j['id_espacio']);
            } elseif (is_array($j) && !empty($j['id'])) {
                $idEsp = intval($j['id']);
            }
        }
        if ($idEsp <= 0) {
            echo json_encode(["status" => "error", "message" => "Falta el ID del espacio"]);
            break;
        }
        eliminar_espacio($conexion, $auth, $idEsp);
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Método no permitido"]);
        break;
}

/**
 * Editar nombre/capacidad (y evento si es superadmin) de un espacio físico.
 * La capacidad no puede bajar por debajo de la ocupación actual.
 */
function editar_espacio($conexion, $auth, $data)
{
    $idEsp = intval($data->id_espacio ?? 0);
    if ($idEsp <= 0) {
        echo json_encode(["status" => "error", "message" => "ID de espacio inválido"]);
        return;
    }

    $row = null;
    $stmt = $conexion->prepare("SELECT id_evento, nombre_espacio, capacidad FROM espacios_fisicos WHERE id_espacio = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $idEsp);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
    }
    if (!$row) {
        echo json_encode(["status" => "error", "message" => "Espacio no encontrado"]);
        return;
    }

    // Admin de evento solo puede editar espacios de SU evento
    $idEventoAdmin = auth_id_evento_admin($conexion, $auth);
    if ($idEventoAdmin !== null && intval($row['id_evento']) !== $idEventoAdmin) {
        echo json_encode(["status" => "error", "message" => "Este espacio no pertenece a tu evento"]);
        return;
    }

    $nombre = isset($data->nombre_espacio) ? trim((string)$data->nombre_espacio) : $row['nombre_espacio'];
    if ($nombre === '') {
        echo json_encode(["status" => "error", "message" => "El nombre es obligatorio"]);
        return;
    }

    $capacidad = isset($data->capacidad) ? intval($data->capacidad) : intval($row['capacidad']);
    if ($capacidad < 1) {
        echo json_encode(["status" => "error", "message" => "La capacidad debe ser al menos 1"]);
        return;
    }

    $stmtOc = $conexion->prepare("SELECT COUNT(*) FROM cargar_posters WHERE id_espacio = ? AND activo = 1");
    $ocupacion = 0;
    if ($stmtOc) {
        $stmtOc->bind_param("i", $idEsp);
        $stmtOc->execute();
        $tmp = $stmtOc->get_result()->fetch_row();
        $ocupacion = intval($tmp[0] ?? 0);
        $stmtOc->close();
    }
    if ($capacidad < $ocupacion) {
        echo json_encode([
            "status" => "error",
            "message" => "La capacidad ({$capacidad}) no puede ser menor que la ocupación actual ({$ocupacion} pósters).",
        ]);
        return;
    }

    $idEvento = intval($row['id_evento']);
    if ((int)$auth['rol'] === 4 && isset($data->id_evento) && intval($data->id_evento) > 0) {
        $idEvento = intval($data->id_evento);
    }

    $ubicacion = $data->ubicacion_detallada ?? null;
    if ($ubicacion !== null) {
        $ubicacion = trim((string)$ubicacion);
        $stmtUpd = $conexion->prepare("UPDATE espacios_fisicos SET nombre_espacio = ?, capacidad = ?, id_evento = ?, ubicacion_detallada = ? WHERE id_espacio = ?");
        $stmtUpd->bind_param("siisi", $nombre, $capacidad, $idEvento, $ubicacion, $idEsp);
    } else {
        $stmtUpd = $conexion->prepare("UPDATE espacios_fisicos SET nombre_espacio = ?, capacidad = ?, id_evento = ? WHERE id_espacio = ?");
        $stmtUpd->bind_param("siii", $nombre, $capacidad, $idEvento, $idEsp);
    }

    if ($stmtUpd && $stmtUpd->execute()) {
        echo json_encode(["status" => "success", "message" => "Espacio actualizado correctamente"]);
    } else {
        error_log('Espacios editar: ' . $conexion->error);
        echo json_encode(["status" => "error", "message" => "No se pudo actualizar el espacio."]);
    }
    if ($stmtUpd) $stmtUpd->close();
}

/**
 * Eliminar espacio. Si tiene pósters activos, se desasignan antes (en transacción).
 */
function eliminar_espacio($conexion, $auth, $idEsp)
{
    $row = null;
    $stmt = $conexion->prepare("SELECT id_evento FROM espacios_fisicos WHERE id_espacio = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $idEsp);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
    }
    if (!$row) {
        echo json_encode(["status" => "error", "message" => "Espacio no encontrado"]);
        return;
    }

    $idEventoAdmin = auth_id_evento_admin($conexion, $auth);
    if ($idEventoAdmin !== null && intval($row['id_evento']) !== $idEventoAdmin) {
        echo json_encode(["status" => "error", "message" => "Este espacio no pertenece a tu evento"]);
        return;
    }

    $stmtOc = $conexion->prepare("SELECT COUNT(*) FROM cargar_posters WHERE id_espacio = ? AND activo = 1");
    $ocupacion = 0;
    if ($stmtOc) {
        $stmtOc->bind_param("i", $idEsp);
        $stmtOc->execute();
        $tmp = $stmtOc->get_result()->fetch_row();
        $ocupacion = intval($tmp[0] ?? 0);
        $stmtOc->close();
    }

    $conexion->begin_transaction();
    try {
        if ($ocupacion > 0) {
            $stmtDes = $conexion->prepare("UPDATE cargar_posters SET id_espacio = NULL WHERE id_espacio = ? AND activo = 1");
            if (!$stmtDes) throw new Exception('desasignar prepare failed');
            $stmtDes->bind_param("i", $idEsp);
            $stmtDes->execute();
            $stmtDes->close();
        }
        $stmtDel = $conexion->prepare("DELETE FROM espacios_fisicos WHERE id_espacio = ?");
        if (!$stmtDel) throw new Exception('delete prepare failed');
        $stmtDel->bind_param("i", $idEsp);
        if (!$stmtDel->execute()) throw new Exception($stmtDel->error);
        $stmtDel->close();
        $conexion->commit();
    } catch (Throwable $e) {
        $conexion->rollback();
        error_log('Espacios eliminar: ' . $e->getMessage());
        echo json_encode(["status" => "error", "message" => "No se pudo eliminar el espacio."]);
        return;
    }

    $msg = "Espacio eliminado correctamente";
    if ($ocupacion > 0) {
        $msg .= ". {$ocupacion} póster(es) quedaron sin ubicación y deben reubicarse.";
    }
    echo json_encode([
        "status" => "success",
        "message" => $msg,
        "pordesasignar" => $ocupacion,
    ]);
}
?>