<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerEvaluacionesDinamicas();
        break;
    case 'POST':
        guardarEvaluacionDinamica();
        break;
}

function obtenerEvaluacionesDinamicas()
{
    global $conexion;
    try {
        $id_poster = isset($_GET['id_poster']) ? intval($_GET['id_poster']) : 0;
        $id_evaluador = isset($_GET['id_evaluador']) ? intval($_GET['id_evaluador']) : 0;

        if ($id_evaluador > 0) {
            $sql = "SELECT id_criterio, calificacion, observaciones 
                    FROM evaluaciones_detalles 
                    WHERE id_poster = ? AND id_evaluador = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ii", $id_poster, $id_evaluador);
        } else {
            $sql = "SELECT id_criterio, calificacion, observaciones 
                    FROM evaluaciones_detalles 
                    WHERE id_poster = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("i", $id_poster);
        }

        $stmt->execute();
        $resultado = $stmt->get_result();

        $detalles = [];
        $observaciones = "";
        while ($row = $resultado->fetch_assoc()) {
            $detalles[$row['id_criterio']] = floatval($row['calificacion']);
            if (!empty($row['observaciones'])) {
                $observaciones = $row['observaciones'];
            }
        }

        echo json_encode([
            'success' => true,
            'evaluaciones' => $detalles,
            'observaciones' => $observaciones
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function guardarEvaluacionDinamica()
{
    global $conexion;
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        $id_poster = intval($data['id_poster']);
        $id_evaluador = intval($data['id_evaluador']);
        $criterios = $data['criterios']; // Arreglo asociativo { id_criterio: nota }
        $observaciones = trim($data['observaciones'] ?? '');

        $sql = "INSERT INTO evaluaciones_detalles (id_poster, id_evaluador, id_criterio, calificacion, observaciones)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    calificacion = VALUES(calificacion),
                    observaciones = VALUES(observaciones)";

        $stmt = $conexion->prepare($sql);

        foreach ($criterios as $id_criterio => $nota) {
            $id_crit = intval($id_criterio);
            $val_nota = floatval($nota);
            $stmt->bind_param("iiids", $id_poster, $id_evaluador, $id_crit, $val_nota, $observaciones);
            $stmt->execute();
        }
        $stmt->close();

        // Calcular el promedio de las notas enviadas por este evaluador
        $sumaNotas = 0;
        $totalCriterios = count($criterios);
        foreach ($criterios as $nota) {
            $sumaNotas += floatval($nota);
        }
        $promedioFinal = $totalCriterios > 0 ? round($sumaNotas / $totalCriterios, 2) : 0;

        // Obtener correo del autor y título del póster para enviarle la notificación
        $sqlAutor = "SELECT p.titulo, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor 
                     FROM cargar_posters p 
                     JOIN usuario u ON p.id_usuario = u.id 
                     WHERE p.id = ?";
        $stmtAutor = $conexion->prepare($sqlAutor);
        $stmtAutor->bind_param("i", $id_poster);
        $stmtAutor->execute();
        $resAutor = $stmtAutor->get_result();

        if ($rowAutor = $resAutor->fetch_assoc()) {
            $asunto = "¡Tu póster ha sido evaluado!";
            $mensaje = "
                <h2>¡Hola, {$rowAutor['nombre_autor']}!</h2>
                <p>Tu póster titulado <strong>'{$rowAutor['titulo']}'</strong> ha recibido una nueva calificación.</p>
                <div style='background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 15px 0;'>
                    <p style='margin: 0 0 10px 0;'><strong>Promedio obtenido:</strong> <span style='color: #0056b3; font-size: 1.2em;'>{$promedioFinal} / 5.0</span></p>
                    <p style='margin: 0;'><strong>Observaciones del evaluador:</strong> {$observaciones}</p>
                </div>
                <p>Puedes ingresar a la plataforma para ver el detalle de los criterios.</p>
            ";
            $destEval = $rowAutor['correo'];
        }
        $stmtAutor->close();

        // Responder primero para no hacer esperar a la UI; el correo sale después
        responderJsonYNotificar(['success' => true, 'message' => 'Evaluación registrada correctamente'], $destEval ?? null, $asunto ?? null, $mensaje ?? null);
        return;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>