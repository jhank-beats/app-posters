<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, PUT, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include_once __DIR__ . '/../Conexion.php';
require_once __DIR__ . '/includes/Correos.php';
require_once __DIR__ . '/includes/PostersHelper.php';

correos_asegurar_tablas_y_columnas($conexion);

$auth = require_role([3, 4]);
$rolActor = intval($auth['rol']);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $globalHabilitado = correos_global_habilitados($conexion);

        $resEventos = $conexion->query(
            "SELECT id_evento, nombre_evento, codigo_evento, carrera, activo, correos_habilitados 
             FROM eventos 
             WHERE activo = 1 
             ORDER BY id_evento ASC"
        );

        $porCarrera = [];
        $eventosActivos = [];

        if ($resEventos) {
            while ($row = $resEventos->fetch_assoc()) {
                $cEv = ph_normalizar_carrera($row['carrera'] ?? 'sistemas');
                $item = [
                    'id_evento' => intval($row['id_evento']),
                    'nombre_evento' => $row['nombre_evento'],
                    'codigo_evento' => $row['codigo_evento'],
                    'carrera' => $cEv,
                    'carrera_etiqueta' => ph_etiqueta_carrera($cEv),
                    'correos_habilitados' => intval($row['correos_habilitados'] ?? 1) === 1,
                ];
                $eventosActivos[] = $item;
                if (!isset($porCarrera[$cEv])) {
                    $porCarrera[$cEv] = $item;
                }
            }
        }

        $idEvAdmin = null;
        $carreraAdmin = null;

        if ($rolActor === 3) {
            $idEvAdmin = auth_id_evento_admin($conexion, $auth);
            $carreraAdmin = auth_carrera_admin($conexion, $auth);
            if ($carreraAdmin !== 'civil') {
                $carreraAdmin = 'sistemas';
            }

            // Filtrar por_carrera para que el Admin solo vea su carrera
            $porCarreraFiltrado = [];
            if (isset($porCarrera[$carreraAdmin])) {
                $porCarreraFiltrado[$carreraAdmin] = $porCarrera[$carreraAdmin];
            } elseif ($idEvAdmin !== null) {
                foreach ($eventosActivos as $ev) {
                    if ($ev['id_evento'] === $idEvAdmin) {
                        $porCarreraFiltrado[$ev['carrera']] = $ev;
                        break;
                    }
                }
            }
            $porCarrera = $porCarreraFiltrado;
        }

        echo json_encode([
            "status" => "success",
            "success" => true,
            "global_habilitado" => $globalHabilitado,
            "por_carrera" => $porCarrera,
            "eventos_activos" => $eventosActivos,
            "es_super_admin" => ($rolActor === 4),
            "carrera_admin" => $carreraAdmin,
            "id_evento_admin" => $idEvAdmin,
        ]);
        exit;

    case 'PUT':
        $raw = file_get_contents("php://input");
        $data = json_decode($raw);
        if (!$data) {
            http_response_code(400);
            echo json_encode(["status" => "error", "success" => false, "message" => "Cuerpo de la petición JSON inválido."]);
            exit;
        }

        $ambito = trim((string)($data->ambito ?? 'carrera'));
        $habilitar = !empty($data->habilitado) ? 1 : 0;

        if ($ambito === 'global') {
            if ($rolActor !== 4) {
                http_response_code(403);
                echo json_encode([
                    "status" => "error",
                    "success" => false,
                    "message" => "Solo el Super Admin puede modificar el interruptor global de correos.",
                ]);
                exit;
            }

            $stmtGlob = $conexion->prepare(
                "INSERT INTO configuracion_sistema (clave, valor, descripcion, actualizado_en)
                 VALUES ('correos_global_habilitados', ?, 'Interruptor general de correos para todo el sistema', NOW())
                 ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_en = NOW()"
            );
            $valStr = (string)$habilitar;
            $stmtGlob->bind_param("s", $valStr);
            $stmtGlob->execute();
            $stmtGlob->close();

            $mensaje = ($habilitar === 1)
                ? "Envío global de correos habilitado exitosamente para todo el sistema."
                : "Envío global de correos pausado temporalmente para todo el sistema.";

            echo json_encode([
                "status" => "success",
                "success" => true,
                "message" => $mensaje,
                "global_habilitado" => ($habilitar === 1),
            ]);
            exit;
        }

        // Modificación por carrera o evento
        $carreraSolicitada = !empty($data->carrera) ? ph_normalizar_carrera($data->carrera) : null;
        $idEventoSolicitado = !empty($data->id_evento) ? intval($data->id_evento) : 0;

        if ($rolActor === 3) {
            $idEvAdmin = auth_id_evento_admin($conexion, $auth);
            $carreraAdmin = auth_carrera_admin($conexion, $auth);
            if ($carreraAdmin !== 'civil') $carreraAdmin = 'sistemas';

            if ($idEventoSolicitado > 0 && $idEventoSolicitado !== intval($idEvAdmin)) {
                http_response_code(403);
                echo json_encode([
                    "status" => "error",
                    "success" => false,
                    "message" => "Solo puedes gestionar los correos de tu evento asignado.",
                ]);
                exit;
            }

            if ($carreraSolicitada && $carreraSolicitada !== $carreraAdmin) {
                http_response_code(403);
                echo json_encode([
                    "status" => "error",
                    "success" => false,
                    "message" => "Solo puedes gestionar los correos de tu propia carrera (" . ph_etiqueta_carrera($carreraAdmin) . ").",
                ]);
                exit;
            }

            $idEventoSolicitado = intval($idEvAdmin);
        } else {
            // Super Admin
            if ($idEventoSolicitado <= 0 && $carreraSolicitada) {
                if ($carreraSolicitada === 'todas') {
                    // Habilitar o pausar todos los eventos activos
                    $stmtAll = $conexion->prepare("UPDATE eventos SET correos_habilitados = ? WHERE activo = 1");
                    $stmtAll->bind_param("i", $habilitar);
                    $stmtAll->execute();
                    $stmtAll->close();

                    echo json_encode([
                        "status" => "success",
                        "success" => true,
                        "message" => ($habilitar === 1)
                            ? "Correos habilitados para todas las carreras activas."
                            : "Correos pausados para todas las carreras activas.",
                    ]);
                    exit;
                }
                $idEventoSolicitado = ph_evento_activo($conexion, $carreraSolicitada);
            }
        }

        if ($idEventoSolicitado <= 0) {
            http_response_code(400);
            echo json_encode(["status" => "error", "success" => false, "message" => "No se pudo identificar el evento a modificar."]);
            exit;
        }

        $stmtUpd = $conexion->prepare("UPDATE eventos SET correos_habilitados = ? WHERE id_evento = ?");
        $stmtUpd->bind_param("ii", $habilitar, $idEventoSolicitado);
        $stmtUpd->execute();
        $stmtUpd->close();

        // Obtener datos actualizados del evento
        $stmtEv = $conexion->prepare("SELECT id_evento, nombre_evento, carrera, correos_habilitados FROM eventos WHERE id_evento = ? LIMIT 1");
        $stmtEv->bind_param("i", $idEventoSolicitado);
        $stmtEv->execute();
        $evActualizado = $stmtEv->get_result()->fetch_assoc();
        $stmtEv->close();

        $cEv = ph_normalizar_carrera($evActualizado['carrera'] ?? 'sistemas');
        $etiqueta = ph_etiqueta_carrera($cEv);

        $mensaje = ($habilitar === 1)
            ? "Envío de correos habilitado para {$etiqueta}."
            : "Envío de correos pausado temporalmente para {$etiqueta}.";

        echo json_encode([
            "status" => "success",
            "success" => true,
            "message" => $mensaje,
            "id_evento" => $idEventoSolicitado,
            "carrera" => $cEv,
            "correos_habilitados" => ($habilitar === 1),
        ]);
        exit;

    default:
        http_response_code(405);
        echo json_encode(["status" => "error", "success" => false, "message" => "Método no permitido."]);
        exit;
}
