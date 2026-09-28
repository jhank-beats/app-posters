<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Content-Type: application/json; charset=UTF-8");

// Incluir el archivo de conexión existente
include_once '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';

// $conexion viene instanciado desde Conexion.php ($conexion = new mysqli(...))
$method = $_SERVER['REQUEST_METHOD'];

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

switch ($method) {

    // 1. OBTENER ESPACIOS Y PÓSTERES ASIGNADOS POR EVENTO
    case 'GET':
        $id_evento = isset($_GET['id_evento']) ? intval($_GET['id_evento']) : null;

        if (!$id_evento) {
            // Si no se envía el id_evento, consultar el evento activo actual
            $sqlActivo = "SELECT id_evento FROM eventos WHERE activo = 1 LIMIT 1";
            $resActivo = $conexion->query($sqlActivo);
            if ($resActivo && $rowActivo = $resActivo->fetch_assoc()) {
                $id_evento = intval($rowActivo['id_evento']);
            } else {
                $id_evento = 1; // Evento por defecto si no hay ninguno activo
            }
        }

        // Consultar los espacios con la cantidad actual de pósteres ocupados
        $sql = "SELECT e.*, 
                       COUNT(p.id) AS ocupacion_actual 
                FROM espacios_fisicos e 
                LEFT JOIN cargar_posters p ON e.id_espacio = p.id_espacio AND p.activo = 1
                WHERE e.id_evento = ?
                GROUP BY e.id_espacio";

        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("i", $id_evento);
        $stmt->execute();
        $resultado = $stmt->get_result();

        $espacios = [];
        while ($row = $resultado->fetch_assoc()) {
            $espacios[] = $row;
        }

        echo json_encode(["status" => "success", "data" => $espacios]);
        $stmt->close();
        break;

    // 2. CREAR UN NUEVO ESPACIO FÍSICO
    case 'POST':
        $data = json_decode(file_get_contents("php://input"));

        if (!empty($data->nombre_espacio) && !empty($data->capacidad)) {
            $nombre = trim($data->nombre_espacio);
            $ubicacion = isset($data->ubicacion_detallada) ? trim($data->ubicacion_detallada) : '';
            $capacidad = intval($data->capacidad);

            // Obtener evento activo actual automáticamente
            $sqlActivo = "SELECT id_evento FROM eventos WHERE activo = 1 LIMIT 1";
            $resActivo = $conexion->query($sqlActivo);
            if ($resActivo && $rowActivo = $resActivo->fetch_assoc()) {
                $id_evento = intval($rowActivo['id_evento']);
            } else {
                $id_evento = 1; // Evento por defecto
            }

            $sql = "INSERT INTO espacios_fisicos (nombre_espacio, ubicacion_detallada, capacidad, id_evento) VALUES (?, ?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssii", $nombre, $ubicacion, $capacidad, $id_evento);

            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Espacio creado correctamente"]);
            } else {
                echo json_encode(["status" => "error", "message" => "Error al guardar el espacio: " . $conexion->error]);
            }
            $stmt->close();
        } else {
            echo json_encode(["status" => "error", "message" => "Datos incompletos"]);
        }
        break;

    // 3. ASIGNAR ESPACIO A UN PÓSTER (VALIDANDO CAPACIDAD MÁXIMA)
    case 'PUT':
        $data = json_decode(file_get_contents("php://input"));

        if (isset($data->id_poster)) {
            $id_poster = intval($data->id_poster);
            $id_espacio = (isset($data->id_espacio) && $data->id_espacio !== null && $data->id_espacio !== "")
                ? intval($data->id_espacio)
                : null;

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
                // Preparar datos del correo SIN enviarlo aún
                $destEsp = null; $asuntoEsp = null; $mensajeEsp = null;
                $sqlAut = "SELECT p.titulo, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor FROM cargar_posters p JOIN usuario u ON p.id_usuario = u.id WHERE p.id = ?";
                $stmtAut = $conexion->prepare($sqlAut);
                $stmtAut->bind_param("i", $id_poster);
                $stmtAut->execute();
                $resAut = $stmtAut->get_result();
                if ($rowAut = $resAut->fetch_assoc()) {
                    $destEsp = $rowAut['correo'];
                    if ($id_espacio === null) {
                        $asuntoEsp = "Espacio liberado para tu póster";
                        $mensajeEsp = "<h2>Hola, {$rowAut['nombre_autor']}!</h2><p>Tu póster <strong>'{$rowAut['titulo']}'</strong> ha sido <strong>desasignado</strong> de su espacio físico. Quedamos atentos a una nueva asignación.</p>";
                    } else {
                        $nomEsp = "espacio asignado";
                        $ubiEsp = "";
                        $sqlEsp = "SELECT nombre_espacio, ubicacion_detallada FROM espacios_fisicos WHERE id_espacio = ?";
                        $stmtEsp = $conexion->prepare($sqlEsp);
                        $stmtEsp->bind_param("i", $id_espacio);
                        $stmtEsp->execute();
                        $resEsp = $stmtEsp->get_result();
                        if ($rowEsp = $resEsp->fetch_assoc()) {
                            $nomEsp = $rowEsp['nombre_espacio'];
                            $ubiEsp = $rowEsp['ubicacion_detallada'];
                        }
                        $stmtEsp->close();
                        $asuntoEsp = "Espacio asignado a tu póster";
                        $mensajeEsp = "<h2>Hola, {$rowAut['nombre_autor']}!</h2><p>Tu póster <strong>'{$rowAut['titulo']}'</strong> ha sido asignado al espacio <strong>'{$nomEsp}'</strong>" . ($ubiEsp !== "" ? " (Ubicación: {$ubiEsp})" : "") . ".</p>";
                    }
                }
                $stmtAut->close();
                // Responder primero, enviar correo después (no bloquea la UI)
                responderJsonYNotificar(["status" => "success", "message" => "Ubicación asignada correctamente"], $destEsp, $asuntoEsp, $mensajeEsp);
                exit;
            } else {
                $errMsg = "Error al actualizar la ubicación: " . $conexion->error;
                $stmtAsignar->close();
                echo json_encode(["status" => "error", "message" => $errMsg]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Falta el ID del póster"]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Método no permitido"]);
        break;
}
?>