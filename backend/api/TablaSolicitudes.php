<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, PUT, DELETE, OPTIONS");

// Solo admin / superadmin (identidad verificada por token).
$auth = require_role([3, 4]);

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php'; // <-- 1. Importamos el archivo de correos

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerSolicitudes();
        break;
    case 'PUT':
        actualizarEstado();
        break;
    case 'DELETE':
        rechazarSolicitud();
        break;
}

function obtenerSolicitudes()
{
    global $conexion;

    $limite = isset($_GET['limite']) ? (int) $_GET['limite'] : null;

    $sql = "SELECT id, nombres, apellidos, correo, carrera, activo, fecha_registro, desactivado
            FROM usuario
            WHERE activo = 0 AND desactivado = 0
            ORDER BY fecha_registro DESC";

    if ($limite) {
        $sql .= " LIMIT $limite";
    }

    $resultado = $conexion->query($sql);
    $solicitudes = [];

    while ($row = $resultado->fetch_assoc()) {
        $solicitudes[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $solicitudes
    ]);
}

function actualizarEstado()
{
    global $conexion;

    // LOG DE PRUEBA INICIAL: Esto DEBE crear el archivo sí o sí al entrar a la función
    file_put_contents('/tmp/correo_debug.txt', "ENTRO A ACTUALIZAR ESTADO\n", FILE_APPEND);

    // Aseguramos que la respuesta sea siempre JSON por más que ocurra un desastre
    $response = ['success' => false, 'message' => 'Error desconocido'];

    try {
        $data = json_decode(file_get_contents('php://input'), true);

        // Guardamos los datos recibidos para verlos en el log
        file_put_contents('/tmp/correo_debug.txt', "Datos recibidos: " . json_encode($data) . "\n", FILE_APPEND);

        $id = isset($data['id']) ? intval($data['id']) : 0;
        $activo = isset($data['activo']) && ($data['activo'] === true || $data['activo'] == 1) ? 1 : 0;

        // 1. Actualizar el estado en la base de datos
        $sql = "UPDATE usuario SET activo = ? WHERE id = ?";
        $sentencia = $conexion->prepare($sql);
        $sentencia->bind_param('ii', $activo, $id);

        if (!$sentencia->execute()) {
            throw new Exception("Error al actualizar estado en la base de datos: " . $sentencia->error);
        }
        $sentencia->close();

        // 2. Si la cuenta fue aprobada, preparamos el correo (se envía tras responder)
        $destSol = null; $asuntoSol = null; $mensajeSol = null;
        if ($activo === 1 && $id > 0) {
            file_put_contents('/tmp/correo_debug.txt', "Condición de correo cumplida para ID: $id\n", FILE_APPEND);

            $sqlInfo = "SELECT nombres, apellidos, correo FROM usuario WHERE id = ?";
            $stmtInfo = $conexion->prepare($sqlInfo);
            $stmtInfo->bind_param("i", $id);
            $stmtInfo->execute();
            $resInfo = $stmtInfo->get_result();

            if ($row = $resInfo->fetch_assoc()) {
                $nombreCompleto = $row['nombres'] . ' ' . $row['apellidos'];
                $destSol = $row['correo'];
                $asuntoSol = "¡Tu cuenta ha sido aprobada!";
                $mensajeSol = "
                    <h2>¡Hola, {$nombreCompleto}!</h2>
                    <p>Tu solicitud de registro ha sido aprobada por el administrador.</p>
                    <p>Ya puedes iniciar sesión en la plataforma y comenzar a utilizar el sistema.</p>
                ";
                file_put_contents('/tmp/correo_debug.txt', "Correo preparado para: {$destSol}\n", FILE_APPEND);
            }
            if (isset($stmtInfo)) {
                $stmtInfo->close();
            }
        }

        $response = [
            'success' => true,
            'message' => 'Estado actualizado correctamente'
        ];

    } catch (\Throwable $e) {
        file_put_contents('/tmp/correo_debug.txt', "EXCEPCIÓN CAPTURADA: " . $e->getMessage() . "\n", FILE_APPEND);
        $response = [
            'success' => false,
            'message' => 'Excepción capturada: ' . $e->getMessage()
        ];
    }

    // Responder primero, enviar correo después para no bloquear la UI
    responderJsonYNotificar($response, $destSol ?? null, $asuntoSol ?? null, $mensajeSol ?? null);
    exit();
}

function rechazarSolicitud()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'];

    $sql = "UPDATE usuario SET desactivado = 1 WHERE id = ? AND activo = 0";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param('i', $id);

    if ($sentencia->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Solicitud rechazada correctamente'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al rechazar solicitud'
        ]);
    }
}
?>