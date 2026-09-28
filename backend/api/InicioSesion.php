<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, OPTIONS");

include '../Conexion.php';
$conexion->set_charset('utf8mb4');

// Anti fuerza-bruta por IP
$ipKey = 'login_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!auth_rate_limit($ipKey, 10, 300)) {
    http_response_code(429);
    echo json_encode(["status" => "error", "message" => "Demasiados intentos. Espera 5 minutos."]);
    exit;
}

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
    // Mensaje genérico: no revela si el correo existe
    echo json_encode(["status" => "error", "message" => "Credenciales inválidas"]);
    exit;
}

$user = $result->fetch_assoc();

// Verificar si está activo
if ((int)$user['activo'] !== 1) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Credenciales inválidas o cuenta inactiva"]);
    exit;
}

// Verificar contraseña (tiempo aprox. constante contra enumeración)
if (!password_verify($contrasena, $user['pass_hash'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Credenciales inválidas"]);
    exit;
}

// Login OK: quitar campos sensibles antes de responder
unset($user['pass_hash']);
unset($user['activo']);

// Emitir token HMAC (12h) — el frontend lo guarda y lo envía en cada petición
$token = auth_issue_token($user['id'], (int)$user['id_rol']);

http_response_code(200);
echo json_encode([
    "status" => "success",
    "message" => "Inicio de sesión exitoso",
    "token" => $token,
    "usuario" => $user  // incluye id_rol
]);
exit;
?>
