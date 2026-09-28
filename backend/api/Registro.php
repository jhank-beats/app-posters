<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

include '../Conexion.php';

// Obtener el JSON enviado desde React
$data = json_decode(file_get_contents("php://input"), true);

if ($data) {
    $nombres = $data['nombres'];
    $apellidos = $data['apellidos'];
    $correo = $data['correo'];
    $contrasena = $data['contrasena'];
    $carrera = $data['carrera'];

    $hash = password_hash($contrasena, PASSWORD_DEFAULT);

    $insertarDatos = "INSERT INTO `usuario`(`nombres`, `apellidos`, `correo`, `contraseña`, `carrera`, `activo`) 
                      VALUES ('$nombres', '$apellidos', '$correo', '$hash', '$carrera', 0)";

    if (mysqli_query($conexion, $insertarDatos)) {
        echo json_encode(["status" => "success", "message" => "Su solicitud ha sido enviada. Debe esperar la aprobación de un administrador."]);
    } else {
        echo json_encode(["status" => "error", "message" => mysqli_error($conexion)]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "No se recibieron datos"]);
}
