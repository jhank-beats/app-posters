<?php
$host = 'localhost';
$db = 'posters';
$user = 'root';
$pass = '1234';

// Crear conexión
$conexion = new mysqli($host, $user, $pass, $db);

// Configurar codificación de caracteres
$conexion->set_charset("utf8mb4");

// Verificar conexión
if ($conexion->connect_error) {
    die("Error de conexión: " . $conexion->connect_error);
}

?>