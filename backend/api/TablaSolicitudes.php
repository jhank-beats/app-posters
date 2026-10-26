<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, PUT, DELETE, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';

// Solo admin / superadmin (identidad verificada por token + cuenta activa).
$auth = require_role([3, 4]);

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

    $auth = $GLOBALS['auth'];
    $rolActual = (int)($auth['rol'] ?? 0);
    $limite = isset($_GET['limite']) ? (int) $_GET['limite'] : null;

    $condiciones = ["u.activo = 0", "u.desactivado = 0"];
    $params = [];
    $types = "";

    // Si es Administrador de evento (rol 3), solo ve solicitudes de su carrera/evento
    if ($rolActual === 3) {
        $cAdmin = auth_carrera_admin($conexion, $auth);
        $idEventoAdmin = auth_id_evento_admin($conexion, $auth);

        if ($cAdmin === 'civil') {
            $condiciones[] = "(u.id_evento = ? OR LOWER(COALESCE(u.carrera, '')) LIKE '%civil%')";
            $params[] = $idEventoAdmin ? $idEventoAdmin : 3;
            $types .= "i";
        } elseif ($cAdmin === 'sistema') {
            $condiciones[] = "(u.id_evento = ? OR LOWER(COALESCE(u.carrera, '')) LIKE '%sistema%' OR LOWER(COALESCE(u.carrera, '')) LIKE '%software%')";
            $params[] = $idEventoAdmin ? $idEventoAdmin : 1;
            $types .= "i";
        }
    }

    $sql = "SELECT u.id, u.nombres, u.apellidos, u.correo, u.carrera,
                   u.id_evento, ev.nombre_evento, ev.codigo_evento,
                   u.activo, u.fecha_registro, u.desactivado
            FROM usuario u
            LEFT JOIN eventos ev ON ev.id_evento = u.id_evento
            WHERE " . implode(" AND ", $condiciones) . "
            ORDER BY u.fecha_registro DESC";

    if ($limite) {
        $sql .= " LIMIT " . intval($limite);
    }

    $stmt = $conexion->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $resultado = $stmt->get_result();
    $solicitudes = [];

    while ($row = $resultado->fetch_assoc()) {
        $solicitudes[] = $row;
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'data' => $solicitudes
    ]);
}

function actualizarEstado()
{
    global $conexion;

    // LOG DE PRUEBA INICIAL: Esto DEBE crear el archivo sí o sí al entrar a la función
    error_log('solicitudes: actualizar estado');

    // Aseguramos que la respuesta sea siempre JSON por más que ocurra un desastre
    $response = ['success' => false, 'message' => 'Error desconocido'];

    try {
        $data = json_decode(file_get_contents('php://input'), true);

        // Guardamos los datos recibidos para verlos en el log
        

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
            error_log('solicitudes: notificar id=' . (int)$id);

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
                error_log('solicitudes: correo preparado');
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
        error_log('solicitudes: ' . $e->getMessage());
        $response = [
            'success' => false,
            'message' => 'No se pudo actualizar la solicitud.'
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