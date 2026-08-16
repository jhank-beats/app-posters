<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include '../Conexion.php';
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
    
    $stmt = $conexion->prepare("SELECT id, nombres, apellidos, correo, carrera FROM usuario WHERE id = ?");
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
    $nombres = trim($input['nombres']);
    $apellidos = trim($input['apellidos']);
    $correo = trim($input['correo']);
    $carrera = trim($input['carrera']);

    // Validar campos obligatorios
    if (empty($nombres) || empty($apellidos) || empty($correo) || empty($carrera)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Todos los campos son obligatorios'
        ]);
        exit;
    }

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
        $stmt = $conexion->prepare("UPDATE usuario SET nombres = ?, apellidos = ?, correo = ?, carrera = ?, `contraseña` = ? WHERE id = ?");
        $stmt->bind_param("sssssi", $nombres, $apellidos, $correo, $carrera, $nuevaContrasenaHash, $id);
    } else {
        // Actualizar sin cambiar contraseña
        $stmt = $conexion->prepare("UPDATE usuario SET nombres = ?, apellidos = ?, correo = ?, carrera = ? WHERE id = ?");
        $stmt->bind_param("ssssi", $nombres, $apellidos, $correo, $carrera, $id);
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