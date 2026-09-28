<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';

if (!isset($conexion) || $conexion->connect_error) {
    echo json_encode([
        'success' => false,
        'message' => 'Error de conexión a la base de datos'
    ]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerEvaluadoresYAsignaciones($conexion);
        break;
    case 'POST':
        guardarAsignacion($conexion);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Método no permitido']);
        break;
}

function obtenerEvaluadoresYAsignaciones($conexion)
{
    try {
        $id_poster = isset($_GET['id_poster']) ? intval($_GET['id_poster']) : 0;
        $carrera = isset($_GET['carrera']) ? trim($_GET['carrera']) : '';

        $sql = "SELECT 
                    u.id, 
                    CONCAT(u.nombres, ' ', u.apellidos) AS nombre_completo,
                    u.correo,
                    u.carrera,
                    IF(ae.id_asignacion IS NOT NULL, 1, 0) AS asignado
                FROM usuario u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                LEFT JOIN asignaciones_evaluadores ae 
                    ON u.id = ae.id_evaluador AND ae.id_poster = ?
                WHERE r.nombre_rol = 'Evaluador'";

        if (!empty($carrera)) {
            $sql .= " AND u.carrera LIKE ?";
        }

        $sql .= " ORDER BY u.nombres ASC";

        $stmt = $conexion->prepare($sql);

        if (!empty($carrera)) {
            $term = "%" . $carrera . "%";
            $stmt->bind_param("is", $id_poster, $term);
        } else {
            $stmt->bind_param("i", $id_poster);
        }

        $stmt->execute();
        $resultado = $stmt->get_result();

        $evaluadores = [];
        while ($row = $resultado->fetch_assoc()) {
            $row['asignado'] = (bool) $row['asignado'];
            $evaluadores[] = $row;
        }

        echo json_encode([
            'success' => true,
            'data' => $evaluadores
        ]);

    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error al obtener evaluadores: ' . $e->getMessage()
        ]);
    }
}

function guardarAsignacion($conexion)
{
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id_poster']) || !isset($data['evaluadores_ids'])) {
            echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
            return;
        }

        $id_poster = intval($data['id_poster']);
        $evaluadores_ids = $data['evaluadores_ids'];

        $conexion->begin_transaction();

        // 1. Limpiar las asignaciones previas de este póster
        $deleteSql = "DELETE FROM asignaciones_evaluadores WHERE id_poster = ?";
        $stmtDelete = $conexion->prepare($deleteSql);
        $stmtDelete->bind_param("i", $id_poster);
        $stmtDelete->execute();
        $stmtDelete->close();

        // Obtener título del póster para el correo
        $sqlPoster = "SELECT titulo FROM cargar_posters WHERE id = ?";
        $stmtP = $conexion->prepare($sqlPoster);
        $stmtP->bind_param("i", $id_poster);
        $stmtP->execute();
        $resP = $stmtP->get_result();
        $tituloPoster = "Póster";
        if ($rowP = $resP->fetch_assoc()) {
            $tituloPoster = $rowP['titulo'];
        }
        $stmtP->close();

        // 2. Insertar las nuevas asignaciones (correos se envían tras responder)
        $notificaciones = [];
        if (!empty($evaluadores_ids)) {
            $insertSql = "INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador) VALUES (?, ?)";
            $stmtInsert = $conexion->prepare($insertSql);

            $sqlEvalInfo = "SELECT CONCAT(nombres, ' ', apellidos) AS nombre_evaluador, correo FROM usuario WHERE id = ?";
            $stmtEvalInfo = $conexion->prepare($sqlEvalInfo);

            foreach ($evaluadores_ids as $id_evaluador) {
                $id_ev = intval($id_evaluador);
                $stmtInsert->bind_param("ii", $id_poster, $id_ev);
                $stmtInsert->execute();

                // Recoger datos para notificar después de responder
                $stmtEvalInfo->bind_param("i", $id_ev);
                $stmtEvalInfo->execute();
                $resEval = $stmtEvalInfo->get_result();
                if ($rowEval = $resEval->fetch_assoc()) {
                    $notificaciones[] = [
                        'correo' => $rowEval['correo'],
                        'asunto' => "Nuevo póster asignado para evaluación",
                        'mensaje' => "
                        <h2>¡Hola, {$rowEval['nombre_evaluador']}!</h2>
                        <p>Se te ha asignado un nuevo póster titulado <strong>'{$tituloPoster}'</strong> para su respectiva evaluación en la plataforma.</p>
                        <p>Por favor ingresa al sistema para revisarlo y registrar tu calificación.</p>
                    "
                    ];
                }
            }
            $stmtInsert->close();
            $stmtEvalInfo->close();
        }

        $conexion->commit();

        $respAsignar = [
            'success' => true,
            'message' => 'Asignación de evaluadores actualizada correctamente'
        ];

        // Responder primero; correos en procesos de fondo (no bloquean la UI)
        if (ob_get_length()) {
            ob_clean();
        }
        echo json_encode($respAsignar);

        foreach ($notificaciones as $n) {
            encolarCorreoFondo($n['correo'], $n['asunto'], $n['mensaje']);
        }
        return;

    } catch (Exception $e) {
        $conexion->rollback();
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar asignación: ' . $e->getMessage()
        ]);
    }
}
?>