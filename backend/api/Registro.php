<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/PostersHelper.php';

// Obtener el JSON enviado desde React
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    echo json_encode(["status" => "error", "success" => false, "message" => "No se recibieron datos"]);
    exit;
}

$nombres = trim((string)($data['nombres'] ?? ''));
$apellidos = trim((string)($data['apellidos'] ?? ''));
$correo = trim((string)($data['correo'] ?? ''));
$contrasena = (string)($data['contrasena'] ?? '');
$carreraRaw = trim((string)($data['carrera'] ?? ''));

if ($nombres === '' || $apellidos === '' || $correo === '' || $contrasena === '' || $carreraRaw === '') {
    echo json_encode(["status" => "error", "success" => false, "message" => "Todos los campos son obligatorios."]);
    exit;
}

if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["status" => "error", "success" => false, "message" => "El correo electrónico no es válido."]);
    exit;
}

// Normalizar la carrera ('sistemas' o 'civil') y resolver el evento activo correspondiente
$carreraNorm = ph_normalizar_carrera($carreraRaw) === 'civil' ? 'civil' : 'sistemas';
$carrera = ph_etiqueta_carrera($carreraNorm);
$idEventoAsignado = ph_evento_activo($conexion, $carreraNorm);

// Verificar si el correo ya existe
$stmtChk = $conexion->prepare("SELECT id FROM usuario WHERE correo = ? LIMIT 1");
if ($stmtChk) {
    $stmtChk->bind_param("s", $correo);
    $stmtChk->execute();
    if ($stmtChk->get_result()->fetch_assoc()) {
        $stmtChk->close();
        echo json_encode(["status" => "error", "success" => false, "message" => "Este correo electrónico ya está registrado."]);
        exit;
    }
    $stmtChk->close();
}

$hash = password_hash($contrasena, PASSWORD_DEFAULT);

$stmt = $conexion->prepare(
    "INSERT INTO `usuario` (`nombres`, `apellidos`, `correo`, `contraseña`, `carrera`, `id_evento`, `activo`) VALUES (?, ?, ?, ?, ?, ?, 0)"
);

if ($stmt) {
    $stmt->bind_param("sssssi", $nombres, $apellidos, $correo, $hash, $carrera, $idEventoAsignado);
    if ($stmt->execute()) {
        $stmt->close();
        echo json_encode([
            "status" => "success",
            "success" => true,
            "message" => "Su solicitud ha sido enviada. Debe esperar la aprobación de un administrador.",
            "id_evento" => $idEventoAsignado,
            "carrera" => $carrera,
        ]);
    } else {
        $err = $stmt->error;
        $stmt->close();
        echo json_encode(["status" => "error", "success" => false, "message" => "Error al registrar la solicitud: " . $err]);
    }
} else {
    echo json_encode(["status" => "error", "success" => false, "message" => "Error al preparar el registro."]);
}
?>
