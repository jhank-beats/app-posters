<?php
// Credenciales por entorno (con fallback dev para no romper localhost).
// En producción define DB_HOST, DB_NAME, DB_USER, DB_PASS y AUTH_SECRET.
$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME') ?: 'posters';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : 'REMOVED_PASS';

try {
    // Crear conexión
    $conexion = new mysqli($host, $user, $pass, $db);
    // Configurar codificación de caracteres
    $conexion->set_charset("utf8mb4");
} catch (Throwable $e) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo json_encode([
        "status" => "error",
        "message" => "Error de conexión a la base de datos: " . $e->getMessage()
    ]);
    exit;
}

?>