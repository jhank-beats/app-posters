<?php
// backend/api/ArreglarUsuarioAlexander.php
// Script de utilidad de un solo uso para corregir o fusionar el usuario Alexander Alvarez.
// Requiere sesión de Super Admin (rol 4) o Admin (rol 3).

require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, OPTIONS");
require_once __DIR__ . '/../Conexion.php';

$auth = require_role([3, 4]);

$stmt = $conexion->prepare("SELECT id, nombres, apellidos, correo, carrera, id_rol, id_evento, activo, desactivado, fecha_registro FROM usuario WHERE correo LIKE '%alexander%' OR nombres LIKE '%alexander%' OR apellidos LIKE '%alvarez%'");
$stmt->execute();
$usuarios = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$action = $_GET['action'] ?? ($_POST['action'] ?? 'consultar');

if ($action === 'consultar') {
    echo json_encode([
        'success' => true,
        'usuarios_encontrados' => $usuarios
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'arreglar') {
    // Buscar si existe el usuario con la r
    $uConR = null;
    $uSinR = null;
    foreach ($usuarios as $u) {
        $c = strtolower(trim($u['correo']));
        if ($c === 'alexander.alvarezr@campusucc.edu.co') {
            $uConR = $u;
        } elseif ($c === 'alexander.alvarez@campusucc.edu.co' || strpos($c, 'alexander.alva') !== false) {
            $uSinR = $u;
        }
    }

    $cambios = [];

    if ($uConR) {
        // Asegurar que esté activo, no desactivado, y con el rol que se pida (o evaluador id_rol=2)
        $nuevoRol = isset($_POST['id_rol']) ? intval($_POST['id_rol']) : 2;
        $stmtFix = $conexion->prepare("UPDATE usuario SET activo = 1, desactivado = 0, id_rol = ? WHERE id = ?");
        $stmtFix->bind_param("ii", $nuevoRol, $uConR['id']);
        $stmtFix->execute();
        $stmtFix->close();
        $cambios[] = "Usuario con la 'r' (ID {$uConR['id']}) activado con id_rol = {$nuevoRol}.";

        // Si existe el otro sin la r, desactivarlo para evitar colisiones
        if ($uSinR && $uSinR['id'] !== $uConR['id']) {
            $stmtDes = $conexion->prepare("UPDATE usuario SET desactivado = 1 WHERE id = ?");
            $stmtDes->bind_param("i", $uSinR['id']);
            $stmtDes->execute();
            $stmtDes->close();
            $cambios[] = "Usuario duplicado/anterior (ID {$uSinR['id']}) desactivado.";
        }
    } elseif ($uSinR) {
        // No existía el de la r pero sí el de sin r: actualizarle el correo a alexander.alvarezr@campusucc.edu.co
        $nuevoRol = isset($_POST['id_rol']) ? intval($_POST['id_rol']) : 2;
        $nuevoCorreo = 'alexander.alvarezr@campusucc.edu.co';
        $stmtUp = $conexion->prepare("UPDATE usuario SET correo = ?, id_rol = ?, activo = 1, desactivado = 0 WHERE id = ?");
        $stmtUp->bind_param("sii", $nuevoCorreo, $nuevoRol, $uSinR['id']);
        $stmtUp->execute();
        $stmtUp->close();
        $cambios[] = "Usuario ID {$uSinR['id']} actualizado con correo {$nuevoCorreo} y id_rol = {$nuevoRol}.";
    }

    echo json_encode([
        'success' => true,
        'mensaje' => 'Operación completada con éxito.',
        'cambios' => $cambios
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
