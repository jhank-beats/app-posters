<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, OPTIONS");

// Toda operación exige sesión válida; el acceso a datos ajenos solo para admin/superadmin.
$auth = require_login();
function cuenta_puede_acceder($targetId) {
    $a = $GLOBALS['auth'];
    if ((int)$targetId === (int)$a['id']) return true;
    return in_array($a['rol'], [3, 4], true);
}

include '../Conexion.php';
include_once __DIR__ . '/includes/PostersHelper.php';
$conexion->set_charset('utf8mb4');

// GET: Obtener datos del usuario
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'ID de usuario no proporcionado'
        ]);
        exit;
    }

    $id = intval($_GET['id']);
    if (!cuenta_puede_acceder($id)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Sin permiso']);
        exit;
    }
    
    $stmt = $conexion->prepare("SELECT id, nombres, apellidos, correo, carrera, id_evento FROM usuario WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Usuario no encontrado'
        ]);
        exit;
    }

    $usuario = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'usuario' => $usuario
    ]);
    
    $stmt->close();
    exit;
}

// POST: Actualizar datos del usuario
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'ID de usuario no proporcionado'
        ]);
        exit;
    }

    $id = intval($input['id']);
    if (!cuenta_puede_acceder($id)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Sin permiso']);
        exit;
    }
    $nombres = trim($input['nombres']);
    $apellidos = trim($input['apellidos']);
    $correo = trim($input['correo']);
    $carreraRaw = trim($input['carrera']);

    // Validar campos obligatorios
    if (empty($nombres) || empty($apellidos) || empty($correo) || empty($carreraRaw)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Todos los campos son obligatorios'
        ]);
        exit;
    }

    $carreraNorm = ph_normalizar_carrera($carreraRaw) === 'civil' ? 'civil' : 'sistemas';
    $carrera = ph_etiqueta_carrera($carreraNorm);
    $idEventoAsignado = ph_evento_activo($conexion, $carreraNorm);

    // Verificar si se está cambiando la contraseña
    $cambiarContrasena = !empty($input['contrasenaActual']) && !empty($input['contrasenaNueva']);

    if ($cambiarContrasena) {
        // Obtener la contraseña actual del usuario
        $stmt = $conexion->prepare("SELECT `contraseña` FROM usuario WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ]);
            exit;
        }

        $usuario = $result->fetch_assoc();
        $stmt->close();

        // Verificar la contraseña actual
        if (!password_verify($input['contrasenaActual'], $usuario['contraseña'])) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'La contraseña actual es incorrecta'
            ]);
            exit;
        }

        // Hash de la nueva contraseña
        $nuevaContrasenaHash = password_hash($input['contrasenaNueva'], PASSWORD_DEFAULT);

        // Actualizar con nueva contraseña
        $stmt = $conexion->prepare("UPDATE usuario SET nombres = ?, apellidos = ?, correo = ?, carrera = ?, id_evento = ?, `contraseña` = ? WHERE id = ?");
        $stmt->bind_param("ssssisi", $nombres, $apellidos, $correo, $carrera, $idEventoAsignado, $nuevaContrasenaHash, $id);
    } else {
        // Actualizar sin cambiar contraseña
        $stmt = $conexion->prepare("UPDATE usuario SET nombres = ?, apellidos = ?, correo = ?, carrera = ?, id_evento = ? WHERE id = ?");
        $stmt->bind_param("ssssii", $nombres, $apellidos, $correo, $carrera, $idEventoAsignado, $id);
    }

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => $cambiarContrasena ? 
                'Datos actualizados correctamente y contraseña cambiada' : 
                'Datos actualizados correctamente'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al actualizar los datos: ' . $stmt->error
        ]);
    }

    $stmt->close();
    exit;
}

// Método no permitido
http_response_code(405);
echo json_encode([
    'success' => false,
    'message' => 'Método no permitido'
]);
exit;
?>