<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, PUT, DELETE, OPTIONS");

include '../Conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        traerCategorias();
        break;
    case 'PUT':
        require_role([3, 4]);
        modificarCategorias();
        break;
    case 'DELETE':
        require_role([3, 4]);
        eliminarCategorias();
        break;
    case 'POST':
        require_role([3, 4]);
        crearCategorias();
        break;
}

function traerCategorias() {
    global $conexion;

    $sql = "SELECT id_categorias, nombre_categorias,
        activo, fecha_registro_categorias
        FROM categorias
        WHERE activo = 1
        ORDER BY nombre_categorias DESC";
    
    $resultado = $conexion->query($sql);
    
    if (!$resultado) {
        error_log('Categorias: ' . $conexion->error);
        echo json_encode([
            'success' => false,
            'message' => 'No se pudieron cargar las categorías.'
        ]);
        return;
    }

    $categorias = [];

    while($row = $resultado->fetch_assoc()) {
        $categorias[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $categorias
    ]);

}

function crearCategorias() {
    global $conexion;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $nombre = $data['nombre_categorias'];

    $sql = "INSERT INTO categorias (nombre_categorias) VALUES (?)";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param("s", $nombre);

    if ($sentencia->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "Categoría creada correctamente"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Error al crear categoría"
        ]);
    }
}

function modificarCategorias() {
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);

    $id = $data['id_categorias'];
    $nombre = $data['nombre_categorias'];

    $sql = "UPDATE categorias SET nombre_categorias=? WHERE id_categorias=?";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param("si", $nombre, $id);

    if ($sentencia->execute()) {
        echo json_encode([
            "success"=> true,
            "message"=> "Categoria modificada"
        ]);
    } else {
        echo json_encode([
            "success"=> false,
            "message"=> "Error al modificar"
        ]);
    }
}

function eliminarCategorias() {
    global $conexion;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    
    $sql = "UPDATE categorias SET activo = 0 WHERE id_categorias = ?";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param('i', $id);
    
    if ($sentencia->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Solicitud rechazada correctamente'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al rechazar solicitud'
        ]);
    }

}
?>