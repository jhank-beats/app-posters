<?php
$host = 'localhost';
$db = 'posters';
$user = 'root';
$pass = '1234';

// Crear conexión
$conexion = new mysqli($host, $user, $pass, $db);



// Verificar conexión
if ($conexion->connect_error) {
    die("Error de conexión: " . $conexion->connect_error);
}

?>