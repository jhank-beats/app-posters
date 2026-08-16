<?php
// ENCABEZADOS CORS OBLIGATORIOS AL INICIO DEL ARCHIVO
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Manejo de petición pre-flight de CORS (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir el archivo de conexión (define $conexion)
require_once '../Conexion.php';

// Verificar que $conexion exista y no tenga error
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

        // 2. Insertar las nuevas asignaciones
        if (!empty($evaluadores_ids)) {
            $insertSql = "INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador) VALUES (?, ?)";
            $stmtInsert = $conexion->prepare($insertSql);

            foreach ($evaluadores_ids as $id_evaluador) {
                $id_ev = intval($id_evaluador);
                $stmtInsert->bind_param("ii", $id_poster, $id_ev);
                $stmtInsert->execute();
            }
        }

        $conexion->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Asignación de evaluadores actualizada correctamente'
        ]);

    } catch (Exception $e) {
        $conexion->rollback();
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar asignación: ' . $e->getMessage()
        ]);
    }
}
?>