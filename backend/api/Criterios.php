<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, PUT, DELETE, OPTIONS");

include '../Conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerCriterios();
        break;
    case 'POST':
        require_role([3, 4]);
        guardarCriterio();
        break;
    case 'DELETE':
        require_role([3, 4]);
        eliminarCriterio();
        break;
}

function obtenerCriterios()
{
    global $conexion;
    try {
        // Opcionalmente se filtra por ronda; siempre se devuelve id_ronda para
        // que la interfaz pueda agrupar los criterios por ronda.
        $id_ronda = isset($_GET['id_ronda']) ? intval($_GET['id_ronda']) : 0;
        if ($id_ronda > 0) {
            $sql = "SELECT * FROM criterios_evaluacion WHERE activo = 1 AND id_ronda = ? ORDER BY id ASC";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("i", $id_ronda);
            $stmt->execute();
            $result = $stmt->get_result();
        } else {
            $sql = "SELECT * FROM criterios_evaluacion WHERE activo = 1 ORDER BY id_ronda ASC, id ASC";
            $result = $conexion->query($sql);
        }
        $criterios = [];
        while ($row = $result->fetch_assoc()) {
            $row['id_ronda'] = intval($row['id_ronda']);
            $criterios[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $criterios]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No fue posible cargar los criterios.']);
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
        // Cada criterio pertenece a una ronda EXPLÍCITA. Sin el fallback a la
        // ronda 1 (que creaba criterios en la ronda equivocada en silencio).
        $id_ronda = isset($data['id_ronda']) ? intval($data['id_ronda']) : 0;
        if ($id_ronda <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Debes indicar la ronda a la que pertenece el criterio (id_ronda).']);
            return;
        }

        if (empty($nombre)) {
            echo json_encode(['success' => false, 'message' => 'El nombre del criterio es obligatorio']);
            return;
        }

        // La ronda debe existir.
        $stmt = $conexion->prepare("SELECT id_ronda FROM rondas WHERE id_ronda = ?");
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) {
            $stmt->close();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'La ronda indicada no existe']);
            return;
        }
        $stmt->close();

        if ($id) {
            $stmt = $conexion->prepare("UPDATE criterios_evaluacion SET nombre = ?, descripcion = ?, id_ronda = ? WHERE id = ?");
            $stmt->bind_param("ssii", $nombre, $descripcion, $id_ronda, $id);
        } else {
            $stmt = $conexion->prepare("INSERT INTO criterios_evaluacion (nombre, descripcion, id_ronda) VALUES (?, ?, ?)");
            $stmt->bind_param("ssi", $nombre, $descripcion, $id_ronda);
        }

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Criterio guardado correctamente']);
        } else {
            throw new Exception($stmt->error);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No fue posible guardar el criterio.']);
    }
}

function eliminarCriterio()
{
    global $conexion;
    try {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id > 0) {
            // No se puede eliminar un criterio que ya tiene evaluaciones
            // guardadas (las notas históricas lo referencian).
            $stmt = $conexion->prepare("SELECT COUNT(*) AS total FROM evaluaciones_detalles WHERE id_criterio = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $fila = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($fila && intval($fila['total']) > 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No se puede eliminar este criterio: ya hay evaluaciones registradas con él.'
                ]);
                return;
            }

            // Desactivado lógico para mantener la integridad de los datos históricos
            $stmt = $conexion->prepare("UPDATE criterios_evaluacion SET activo = 0 WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'Criterio eliminado correctamente']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No fue posible eliminar el criterio.']);
    }
}
?>