<?php
// 1. Configuración de encabezados CORS y tipo de respuesta
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// 2. Responder inmediatamente a las peticiones pre-flight OPTIONS del navegador
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../Conexion.php'; // Usa la conexión $conexion heredada de Conexion.php

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // -------------------------------------------------------------
    // 1. OBTENER EVENTOS (GET)
    // -------------------------------------------------------------
    case 'GET':
        if (isset($_GET['activo']) && $_GET['activo'] == '1') {
            // Devuelve únicamente el evento actualmente activo
            $sql = "SELECT * FROM eventos WHERE activo = 1 LIMIT 1";
            $res = $conexion->query($sql);
            $evento = $res ? $res->fetch_assoc() : null;
            echo json_encode(["status" => "success", "data" => $evento]);
        } else {
            // Devuelve TODOS los eventos (activos de primero, luego por ID descendente)
            $sql = "SELECT * FROM eventos ORDER BY activo DESC, id_evento DESC";
            $res = $conexion->query($sql);
            $eventos = [];
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $eventos[] = $row;
                }
            }
            echo json_encode(["status" => "success", "data" => $eventos]);
        }
        break;

    // -------------------------------------------------------------
    // 2. CREAR UN NUEVO EVENTO (POST)
    // -------------------------------------------------------------
    case 'POST':
        $data = json_decode(file_get_contents("php://input"));

        if (!$data) {
            echo json_encode(["status" => "error", "message" => "Cuerpo de la petición JSON inválido."]);
            exit;
        }

        // Validación de Rol
        if (!isset($data->rol_usuario) || strtolower($data->rol_usuario) !== 'superadmin') {
            echo json_encode(["status" => "error", "message" => "Acceso denegado. Solo el Superadministrador puede crear eventos."]);
            exit;
        }

        if (!empty($data->nombre_evento) && !empty($data->codigo_evento)) {
            $nombre = trim($data->nombre_evento);
            $codigo = trim($data->codigo_evento);
            $inicio = !empty($data->fecha_inicio) ? $data->fecha_inicio : NULL;
            $fin = !empty($data->fecha_fin) ? $data->fecha_fin : NULL;

            $sql = "INSERT INTO eventos (nombre_evento, codigo_evento, fecha_inicio, fecha_fin, activo) VALUES (?, ?, ?, ?, 0)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssss", $nombre, $codigo, $inicio, $fin);

            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Evento creado correctamente"]);
            } else {
                echo json_encode(["status" => "error", "message" => "Error al crear evento: " . $conexion->error]);
            }
            $stmt->close();
        } else {
            echo json_encode(["status" => "error", "message" => "Nombre y código del evento son obligatorios."]);
        }
        break;

    // -------------------------------------------------------------
    // 3. EDITAR / ACTIVAR EVENTO (PUT)
    // -------------------------------------------------------------
    case 'PUT':
        $data = json_decode(file_get_contents("php://input"));

        if (!$data) {
            echo json_encode(["status" => "error", "message" => "Cuerpo de la petición JSON inválido."]);
            exit;
        }

        // Validación de Rol
        if (!isset($data->rol_usuario) || strtolower($data->rol_usuario) !== 'superadmin') {
            echo json_encode(["status" => "error", "message" => "Acceso denegado. Solo el Superadministrador puede modificar eventos."]);
            exit;
        }

        // CASO A: Activar un evento específico (y desactivar los demás)
        if (isset($data->accion) && $data->accion === 'activar' && !empty($data->id_evento)) {
            $id_evento = intval($data->id_evento);
            $conexion->begin_transaction();
            try {
                $conexion->query("UPDATE eventos SET activo = 0");
                $stmt = $conexion->prepare("UPDATE eventos SET activo = 1 WHERE id_evento = ?");
                $stmt->bind_param("i", $id_evento);
                $stmt->execute();
                $conexion->commit();
                echo json_encode(["status" => "success", "message" => "Evento activado correctamente"]);
            } catch (Exception $e) {
                $conexion->rollback();
                echo json_encode(["status" => "error", "message" => "Error al activar el evento: " . $e->getMessage()]);
            }
            exit;
        }

        // CASO B: Editar datos de un evento (Nombre, Código, Fechas)
        if (!empty($data->id_evento) && !empty($data->nombre_evento) && !empty($data->codigo_evento)) {
            $id_evento = intval($data->id_evento);
            $nombre = trim($data->nombre_evento);
            $codigo = trim($data->codigo_evento);
            $inicio = !empty($data->fecha_inicio) ? $data->fecha_inicio : NULL;
            $fin = !empty($data->fecha_fin) ? $data->fecha_fin : NULL;

            $sql = "UPDATE eventos SET nombre_evento = ?, codigo_evento = ?, fecha_inicio = ?, fecha_fin = ? WHERE id_evento = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssssi", $nombre, $codigo, $inicio, $fin, $id_evento);

            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Evento actualizado correctamente"]);
            } else {
                echo json_encode(["status" => "error", "message" => "Error al actualizar el evento: " . $conexion->error]);
            }
            $stmt->close();
        } else {
            echo json_encode(["status" => "error", "message" => "Datos incompletos para actualizar el evento."]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Método HTTP no permitido"]);
        break;
}
?>