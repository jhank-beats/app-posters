<?php
// Credenciales solo por entorno o backend/.env. Sin fallbacks en código.
require_once __DIR__ . '/api/includes/Env.php';

$host = app_env('DB_HOST', 'localhost');
$db   = app_env('DB_NAME');
$user = app_env('DB_USER');
$pass = app_env('DB_PASS');

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
    // Forzar zona horaria de Colombia (UTC-5) en la sesión de base de datos
    $conexion->query("SET time_zone = '-05:00'");
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