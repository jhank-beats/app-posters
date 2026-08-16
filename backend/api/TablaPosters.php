<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include '../Conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        traerPosters();
        break;
    case 'PUT':
        modificarPoster();
        break;
    case 'DELETE':
        eliminarPoster();
        break;
}

function traerPosters()
{
    global $conexion;
    try {
        $id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;
        $id_evaluador = isset($_GET['id_evaluador']) ? intval($_GET['id_evaluador']) : null;

        $sql = "SELECT 
                    p.id,
                    p.id_usuario,
                    p.titulo,
                    p.autores,
                    p.descripcion,
                    p.categoria,
                    p.palabrasClave AS palabras_clave,
                    CASE
                        WHEN p.ruta_imagen LIKE 'http%' THEN p.ruta_imagen
                        WHEN p.ruta_imagen LIKE 'imgPosters/%' THEN CONCAT('http://localhost/app-posters/backend/', p.ruta_imagen)
                        WHEN p.ruta_imagen LIKE 'src/assets/imgPosters/%' THEN CONCAT('http://localhost/app-posters/backend/', SUBSTRING(p.ruta_imagen, 11))
                        ELSE CONCAT('http://localhost/app-posters/backend/imgPosters/', p.ruta_imagen)
                    END AS imagen,
                    DATE_FORMAT(p.fecha_registro, '%d/%m/%Y %H:%i') AS fecha_registro,
                    CONCAT(u.nombres, ' ', u.apellidos) AS nombre_usuario
                FROM cargar_posters p
                LEFT JOIN usuario u ON p.id_usuario = u.id";

        // Si se consulta como evaluador, filtramos solo los pósteres asignados
        if ($id_evaluador !== null) {
            $sql .= " INNER JOIN asignaciones_evaluadores ae ON p.id = ae.id_poster WHERE ae.id_evaluador = " . $id_evaluador . " AND p.activo = 1";
        } else {
            $sql .= " WHERE p.activo = 1";
        }

        // Si se busca por autor / dueño del póster
        if ($id_usuario !== null) {
            $sql .= " AND p.id_usuario = " . $id_usuario;
        }

        $sql .= " ORDER BY p.fecha_registro DESC";

        $resultado = mysqli_query($conexion, $sql);

        if (!$resultado) {
            throw new Exception(mysqli_error($conexion));
        }

        $posters = [];
        while ($row = mysqli_fetch_assoc($resultado)) {
            $posters[] = $row;
        }

        echo json_encode([
            'success' => true,
            'data' => $posters,
            'count' => count($posters)
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al cargar pósters: ' . $e->getMessage()
        ]);
    }
}

function modificarPoster()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);

    $id = $data['id'];
    $titulo = $data['titulo'];
    $autores = $data['autores'];
    $descripcion = $data['descripcion'];
    $categoria = $data['categoria'];
    $palabrasClave = $data['palabrasClave'];

    $sql = "UPDATE cargar_posters SET titulo = ?, autores = ?, descripcion = ?, categoria = ?, palabrasClave = ? WHERE id = ?";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param("sssssi", $titulo, $autores, $descripcion, $categoria, $palabrasClave, $id);

    if ($sentencia->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Póster modificado correctamente"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Error al modificar póster"
        ]);
    }
}

function eliminarPoster()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];

    $sql = "UPDATE cargar_posters SET activo = 0 WHERE id = ?";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param('i', $id);

    if ($sentencia->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Póster eliminado correctamente'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al eliminar póster'
        ]);
    }
}
?>