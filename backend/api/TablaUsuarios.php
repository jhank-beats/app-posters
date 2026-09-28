<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, PUT, DELETE, OPTIONS");

// La identidad/rol vienen del token verificado, NO de parámetros del cliente.
$auth = require_role([3, 4]);

include '../Conexion.php';
// Si el archivo está dentro de api/ y includes/ también está dentro de api/:
include_once __DIR__ . '/includes/Correos.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerUsuarios();
        break;
    case 'PUT':
        actualizarUsuario();
        break;
    case 'DELETE':
        eliminarUsuario();
        break;
}

function obtenerUsuarios()
{
    global $conexion;

    // Identidad verificada por token (ignora cualquier admin_id del cliente)
    $adminId = $GLOBALS['auth']['id'];

    $rolQuery = "SELECT id_rol FROM usuario WHERE id = ?";
    $stmtRol = $conexion->prepare($rolQuery);
    $stmtRol->bind_param('i', $adminId);
    $stmtRol->execute();
    $resultadoRol = $stmtRol->get_result();
    $usuarioActual = $resultadoRol->fetch_assoc();
    $stmtRol->close();

    if (!$usuarioActual) {
        echo json_encode([
            'success' => false,
            'message' => 'Usuario actual no encontrado'
        ]);
        return;
    }

    $rolActual = intval($usuarioActual['id_rol']);

    $sqlBase = "SELECT u.id, u.nombres, u.apellidos, u.correo, u.carrera, 
                    u.id_rol, u.fecha_registro, r.nombre_rol AS nombre_rol
                FROM usuario u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                WHERE u.desactivado = 0 
                AND u.activo = 1
                AND u.id != ?";

    if ($rolActual === 3) {
        $sqlBase .= " AND u.id_rol IN (1, 2)";
    }

    $sqlBase .= " ORDER BY u.nombres ASC";

    $stmt = $conexion->prepare($sqlBase);
    $stmt->bind_param('i', $adminId);
    $stmt->execute();
    $resultado = $stmt->get_result();

    $usuarios = [];

    while ($row = $resultado->fetch_assoc()) {
        $usuarios[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $usuarios
    ]);

    $stmt->close();
}

function actualizarUsuario()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = isset($data['id']) ? intval($data['id']) : 0;
    // Identidad verificada por token (ignora admin_id del cliente)
    $adminId = $GLOBALS['auth']['id'];

    if (!$id || !$adminId) {
        echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
        return;
    }

    // Obtener rol del administrador que realiza la petición
    $rolQuery = "SELECT id_rol FROM usuario WHERE id = ?";
    $stmtRol = $conexion->prepare($rolQuery);
    $stmtRol->bind_param('i', $adminId);
    $stmtRol->execute();
    $resultadoRol = $stmtRol->get_result();
    $usuarioActual = $resultadoRol->fetch_assoc();
    $stmtRol->close();

    if (!$usuarioActual) {
        echo json_encode(['success' => false, 'message' => 'Usuario actual no encontrado']);
        return;
    }

    $rolActual = intval($usuarioActual['id_rol']);

    if ($adminId === $id) {
        echo json_encode(['success' => false, 'message' => 'No puedes modificar tu propio usuario desde aquí']);
        return;
    }

    // Verificar usuario objetivo (traemos correo y estado activo previo si lo necesitas)
    $check_sql = "SELECT id_rol, correo, activo, nombres FROM usuario WHERE id = ?";
    $check_stmt = $conexion->prepare($check_sql);
    $check_stmt->bind_param('i', $id);
    $check_stmt->execute();
    $check_result = $check_stmt->get_result();

    if ($check_result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Usuario objetivo no encontrado']);
        return;
    }

    $usuarioObjetivo = $check_result->fetch_assoc();
    $rolObjetivo = intval($usuarioObjetivo['id_rol']);
    $correoObjetivo = $usuarioObjetivo['correo'];
    $nombreObjetivo = $usuarioObjetivo['nombres'];
    $estadoAnterior = intval($usuarioObjetivo['activo']);
    $check_stmt->close();

    // Validar permisos
    if ($rolActual === 3 && !in_array($rolObjetivo, [1, 2])) {
        echo json_encode(['success' => false, 'message' => 'No está permitido modificar este usuario']);
        return;
    }
    if ($rolActual === 4 && $rolObjetivo === 4) {
        echo json_encode(['success' => false, 'message' => 'No puedes modificar a otro Super Admin']);
        return;
    }

    // CASO A: Solo cambiar Rol u otros estados (como activar la cuenta si se envía el parámetro 'activo')
    if (isset($data['id_rol']) && !isset($data['nombres'])) {
        $id_rol = intval($data['id_rol']);

        if ($rolActual === 3 && !in_array($id_rol, [1, 2])) {
            echo json_encode(['success' => false, 'message' => 'Rol destino no permitido']);
            return;
        }

        $sql = "UPDATE usuario SET id_rol = ? WHERE id = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param('ii', $id_rol, $id);

        if ($stmt->execute()) {
            $stmt->close();
            responderJsonYNotificar(['success' => true, 'message' => 'Rol actualizado correctamente'], $correoObjetivo, "Tu rol ha sido actualizado", "<h2>Hola, {$nombreObjetivo}!</h2><p>Tu rol en la plataforma ha sido actualizado por el administrador.</p>");
            return;
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar rol']);
        }
        $stmt->close();
        return;
    }

    // CASO B: Si en la petición viene explícitamente la activación de cuenta
    $nuevoActivo = isset($data['activo']) ? $data['activo'] : null;

    if ($nuevoActivo !== null) {
        // Convertir boolean o int a 1 o 0 seguro
        $valActivoInt = $nuevoActivo ? 1 : 0;

        $sqlActivo = "UPDATE usuario SET activo = ? WHERE id = ?";
        $stmtActivo = $conexion->prepare($sqlActivo);
        $stmtActivo->bind_param('ii', $valActivoInt, $id);

        if ($stmtActivo->execute()) {
            $stmtActivo->close();
            // ENVIAR CORREO SIEMPRE QUE SE ACTIVE LA CUENTA (después de responder)
            if ($valActivoInt === 1) {
                file_put_contents('/tmp/correo_debug.txt', "Disparando correo de admisión para: {$correoObjetivo}\n", FILE_APPEND);
                responderJsonYNotificar(['success' => true, 'message' => 'Estado de activación actualizado correctamente'], $correoObjetivo, "¡Bienvenido! Has sido admitido en la plataforma", "
                    <h2>¡Hola, {$nombreObjetivo}!</h2>
                    <p>Nos complace informarte que tu cuenta ha sido <strong>admitida</strong> y activada exitosamente en la plataforma de pósteres.</p>
                    <p>Ya puedes iniciar sesión con tus credenciales y comenzar a utilizar el sistema.</p>
                ");
            } else {
                echo json_encode(['success' => true, 'message' => 'Estado de activación actualizado correctamente']);
            }
            return;
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al actualizar el estado de activación']);
        }
        $stmtActivo->close();
        return;
    }

    // CASO C: Editar datos personales (Nombres, Apellidos, Correo, Carrera)
    $nombres = trim($data['nombres'] ?? '');
    $apellidos = trim($data['apellidos'] ?? '');
    $correo = trim($data['correo'] ?? '');
    $carrera = trim($data['carrera'] ?? '');

    if (empty($nombres) || empty($apellidos) || empty($correo)) {
        echo json_encode(['success' => false, 'message' => 'Nombres, apellidos y correo son obligatorios']);
        return;
    }

    // Verificar correo duplicado en otro usuario
    $checkCorreo = "SELECT id FROM usuario WHERE correo = ? AND id != ?";
    $stmtCorreo = $conexion->prepare($checkCorreo);
    $stmtCorreo->bind_param('si', $correo, $id);
    $stmtCorreo->execute();
    if ($stmtCorreo->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'El correo electrónico ya está registrado por otro usuario']);
        $stmtCorreo->close();
        return;
    }
    $stmtCorreo->close();

    $sql = "UPDATE usuario SET nombres = ?, apellidos = ?, correo = ?, carrera = ? WHERE id = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param('ssssi', $nombres, $apellidos, $correo, $carrera, $id);

    if ($stmt->execute()) {
        $stmt->close();
        responderJsonYNotificar(['success' => true, 'message' => 'Información del usuario actualizada correctamente'], $correo, "Tu información ha sido actualizada", "<h2>Hola, {$nombres}!</h2><p>Tu información personal ha sido modificada por el administrador.</p><p>Datos actualizados:<br>Nombres: {$nombres}<br>Apellidos: {$apellidos}<br>Correo: {$correo}<br>Carrera: {$carrera}</p>");
        return;
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al actualizar la información del usuario']);
    }

    $stmt->close();
}

function eliminarUsuario()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);

    $check_sql = "SELECT id_rol FROM usuario WHERE id = ?";
    $check_stmt = $conexion->prepare($check_sql);
    $check_stmt->bind_param('i', $id);
    $check_stmt->execute();
    $check_result = $check_stmt->get_result();

    if ($check_result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
        return;
    }

    $usuario = $check_result->fetch_assoc();

    if ($usuario['id_rol'] == 3 || $usuario['id_rol'] == 4) {
        echo json_encode(['success' => false, 'message' => 'No está permitido eliminar un administrador']);
        return;
    }

    $check_stmt->close();

    $sql = "UPDATE usuario SET desactivado = 1 WHERE id = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param('i', $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Usuario eliminado correctamente']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al eliminar usuario']);
    }

    $stmt->close();
}
?>