<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include '../Conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerCriterios();
        break;
    case 'POST':
        guardarCriterio();
        break;
    case 'DELETE':
        eliminarCriterio();
        break;
}

function obtenerCriterios()
{
    global $conexion;
    try {
        $sql = "SELECT * FROM criterios_evaluacion WHERE activo = 1 ORDER BY id ASC";
        $result = $conexion->query($sql);
        $criterios = [];
        while ($row = $result->fetch_assoc()) {
            $criterios[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $criterios]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function guardarCriterio()
{
    global $conexion;
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = isset($data['id']) ? intval($data['id']) : null;
        $nombre = trim($data['nombre']);
        $descripcion = trim($data['descripcion'] ?? '');

        if (empty($nombre)) {
            echo json_encode(['success' => false, 'message' => 'El nombre del criterio es obligatorio']);
            return;
        }

        if ($id) {
            $stmt = $conexion->prepare("UPDATE criterios_evaluacion SET nombre = ?, descripcion = ? WHERE id = ?");
            $stmt->bind_param("ssi", $nombre, $descripcion, $id);
        } else {
            $stmt = $conexion->prepare("INSERT INTO criterios_evaluacion (nombre, descripcion) VALUES (?, ?)");
            $stmt->bind_param("ss", $nombre, $descripcion);
        }

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Criterio guardado correctamente']);
        } else {
            throw new Exception($stmt->error);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function eliminarCriterio()
{
    global $conexion;
    try {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id > 0) {
            // Desactivado lógico para mantener la integridad de los datos históricos
            $stmt = $conexion->prepare("UPDATE criterios_evaluacion SET activo = 0 WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'Criterio eliminado correctamente']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>