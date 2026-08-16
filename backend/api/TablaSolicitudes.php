<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

include '../Conexion.php';

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        obtenerSolicitudes();
        break;
    case 'PUT':
        actualizarEstado();
        break;
    case 'DELETE':
        rechazarSolicitud();
        break;
}

function obtenerSolicitudes() {
    global $conexion;


    $limite = isset($_GET['limite']) ? (int)$_GET['limite'] : null;

    $sql = "SELECT id, nombres, apellidos, correo, carrera, activo, fecha_registro, desactivado
            FROM usuario
            WHERE activo = 0 AND desactivado = 0
            ORDER BY fecha_registro DESC";

    if ($limite) {
        $sql .= " LIMIT $limite";
    }
    
    $resultado = $conexion->query($sql);
    $solicitudes = [];

    while($row = $resultado->fetch_assoc()) {
        $solicitudes[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $solicitudes
    ]);
}

function actualizarEstado() {
    global $conexion;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    $activo = $data['activo'] ? 1 : 0;
    
    $sql = "UPDATE usuario SET activo = ? WHERE id = ?";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param('ii', $activo, $id);
    
    if ($sentencia->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Estado actualizado correctamente'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al actualizar estado'
        ]);
    }
}

function rechazarSolicitud() { 
    global $conexion;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];
    
    $sql = "UPDATE usuario SET desactivado = 1 WHERE id = ? AND activo = 0";
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