<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include '../Conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerEvaluacion();
        break;
    case 'POST':
        guardarEvaluacion();
        break;
}

function obtenerEvaluacion()
{
    global $conexion;
    try {
        $id_poster = isset($_GET['id_poster']) ? intval($_GET['id_poster']) : 0;
        $id_evaluador = isset($_GET['id_evaluador']) ? intval($_GET['id_evaluador']) : null;

        $sql = "SELECT 
                    e.*,
                    CONCAT(u.nombres, ' ', u.apellidos) AS nombre_evaluador
                FROM evaluaciones e
                INNER JOIN usuario u ON e.id_evaluador = u.id
                WHERE e.id_poster = ?";

        if ($id_evaluador !== null) {
            $sql .= " AND e.id_evaluador = " . $id_evaluador;
        }

        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("i", $id_poster);
        $stmt->execute();
        $resultado = $stmt->get_result();

        $evaluaciones = [];
        while ($row = $resultado->fetch_assoc()) {
            $evaluaciones[] = $row;
        }

        echo json_encode([
            'success' => true,
            'data' => $evaluaciones
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al consultar evaluaciones: ' . $e->getMessage()
        ]);
    }
}

function guardarEvaluacion()
{
    global $conexion;
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        $id_poster = intval($data['id_poster']);
        $id_evaluador = intval($data['id_evaluador']);
        $calificacion_contenido = floatval($data['calificacion_contenido']);
        $calificacion_diseno = floatval($data['calificacion_diseno']); // valor recibido desde React
        $calificacion_exposicion = floatval($data['calificacion_exposicion']);
        $observaciones = trim($data['observaciones'] ?? '');

        // Promedio directo
        $promedio_total = round(($calificacion_contenido + $calificacion_diseno + $calificacion_exposicion) / 3, 2);

        // INSERT u UPDATE con el nombre correcto de la columna (calificacion_diseño)
        $sql = "INSERT INTO evaluaciones 
                    (id_poster, id_evaluador, calificacion_contenido, calificacion_diseño, calificacion_exposicion, promedio_total, observaciones) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    calificacion_contenido = VALUES(calificacion_contenido),
                    calificacion_diseño = VALUES(calificacion_diseño),
                    calificacion_exposicion = VALUES(calificacion_exposicion),
                    promedio_total = VALUES(promedio_total),
                    observaciones = VALUES(observaciones),
                    fecha_evaluacion = CURRENT_TIMESTAMP";

        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("iidddds", $id_poster, $id_evaluador, $calificacion_contenido, $calificacion_diseno, $calificacion_exposicion, $promedio_total, $observaciones);

        if ($stmt->execute()) {
            echo json_encode([
                'success' => true,
                'message' => 'Evaluación guardada correctamente',
                'promedio_total' => $promedio_total
            ]);
        } else {
            throw new Exception($stmt->error);
        }

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar evaluación: ' . $e->getMessage()
        ]);
    }
}
?>