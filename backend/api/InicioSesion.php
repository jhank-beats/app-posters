<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include '../Conexion.php';
$conexion->set_charset('utf8mb4');

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['correo']) || empty($input['contrasena'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Faltan datos: correo y/o contraseña"]);
    exit;
}

$correo = trim($input['correo']);
$contrasena = $input['contrasena'];

$stmt = $conexion->prepare("SELECT id, nombres, apellidos, correo, `contraseña` AS pass_hash, activo, id_rol FROM usuario WHERE correo = ? LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Error en el servidor (prepare)"]);
    exit;
}

$stmt->bind_param("s", $correo);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Usuario o contraseña incorrectos"]);
    exit;
}

$user = $result->fetch_assoc();

// Verificar si está activo
if ((int)$user['activo'] !== 1) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "El usuario no ha sido activado por un administrador"]);
    exit;
}

// Verificar contraseña
if (!password_verify($contrasena, $user['pass_hash'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Usuario o contraseña incorrectos"]);
    exit;
}

// Login OK: quitar campos sensibles antes de responder
unset($user['pass_hash']);
unset($user['activo']);

http_response_code(200);
echo json_encode([
    "status" => "success",
    "message" => "Inicio de sesión exitoso",
    "usuario" => $user  // Ahora incluye id_rol
]);
exit;
?>