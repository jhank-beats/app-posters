<?php
// Credenciales solo por entorno. Sin fallbacks en código.
// Define DB_HOST, DB_NAME, DB_USER y DB_PASS (ver .env.example).
function conexion_env($clave, $porDefecto = null)
{
    $v = getenv($clave);
    if ($v !== false && $v !== '') return $v;
    if (isset($_ENV[$clave]) && $_ENV[$clave] !== '') return $_ENV[$clave];
    if (isset($_SERVER[$clave]) && $_SERVER[$clave] !== '') return $_SERVER[$clave];
    return $porDefecto;
}

$host = conexion_env('DB_HOST', 'localhost');
$db   = conexion_env('DB_NAME');
$user = conexion_env('DB_USER');
$pass = conexion_env('DB_PASS');

if ($db === null || $user === null || $pass === null) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo json_encode(["status" => "error", "message" => "Error de configuración del servidor."]);
    exit;
}

try {
    $conexion = new mysqli($host, $user, $pass, $db);
    $conexion->set_charset("utf8mb4");
} catch (Throwable $e) {
    error_log('DB connect failed: ' . $e->getMessage());
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo json_encode(["status" => "error", "message" => "Error de conexión a la base de datos."]);
    exit;
}

?>