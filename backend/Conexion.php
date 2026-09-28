<?php
// Credenciales por entorno (con fallback dev para no romper localhost).
// En producción define DB_HOST, DB_NAME, DB_USER, DB_PASS y AUTH_SECRET.
$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME') ?: 'posters';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '1234';

// Crear conexión
$conexion = new mysqli($host, $user, $pass, $db);

// Configurar codificación de caracteres
$conexion->set_charset("utf8mb4");

// Verificar conexión
if ($conexion->connect_error) {
    die("Error de conexión: " . $conexion->connect_error);
}

?>