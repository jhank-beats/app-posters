<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';

// Detección de duplicados y registro
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    // Datos enviados desde FormData
    $titulo = $_POST['titulo'] ?? '';
    $autores = $_POST['autores'] ?? '';
    $descripcion = $_POST['descripcion'] ?? '';
    $categoria = $_POST['categoria'] ?? '';
    $palabrasClave = $_POST['palabrasClave'] ?? '';
    $id_usuario = $_POST['id_usuario'] ?? null;

    // Lectura de parámetro para la detección
    $forzar_guardado = $_POST['forzar_guardado'] ?? 'false';

    if (!$id_usuario || !is_numeric($id_usuario)) {
        echo json_encode(["status" => "error", "message" => "ID de usuario no válido"]);
        return;
    }
    $id_usuario = intval($id_usuario);

    // 1. Sanitizar todas las variables globalmente (sirve para consulta e inserción)
    $titulo_escapado = mysqli_real_escape_string($conexion, $titulo);
    $descripcion_escapada = mysqli_real_escape_string($conexion, $descripcion);
    $autores_escapado = mysqli_real_escape_string($conexion, $autores);
    $categoria_escapada = mysqli_real_escape_string($conexion, $categoria);
    $palabrasClave_escapadas = mysqli_real_escape_string($conexion, $palabrasClave);

    // 2. Proceso de validación de duplicados
    if ($forzar_guardado != 'true') {
        $coincide_titulo = false;
        $coincide_descripcion = false;

        $titulo_min = mb_strtolower(trim($titulo));
        $descripcion_min = mb_strtolower(trim($descripcion));

        // Definición de la consulta 
        $consulta_duplicados = "SELECT * FROM cargar_posters WHERE LOWER(titulo) = LOWER('$titulo_escapado') OR LOWER(descripcion) = LOWER('$descripcion_escapada')";
        $resultado = mysqli_query($conexion, $consulta_duplicados);

        // Comprobar las coincidencias
        if ($resultado && mysqli_num_rows($resultado) > 0) {
            $duplicados = [];

            while ($fila = mysqli_fetch_assoc($resultado)) {
                $duplicados[] = $fila;

                $titulo_bd_min = mb_strtolower($fila['titulo']);
                if ($titulo_bd_min === $titulo_min) {
                    $coincide_titulo = true;
                }

                if (!empty($descripcion)) {
                    $descripcion_bd_min = mb_strtolower($fila['descripcion']);
                    if (str_contains($descripcion_bd_min, $descripcion_min)) {
                        $coincide_descripcion = true;
                    }
                }
            }

            // Mensajes según la coincidencia
            if ($coincide_descripcion && $coincide_titulo) {
                $mensaje = "Se encontraron pósteres con un título y una descripción similares.";
            } else if ($coincide_titulo) {
                $mensaje = "Se encontraron pósteres con un título similar.";
            } else {
                $mensaje = "Se encontraron pósteres con una descripción similar.";
            }

            echo json_encode([
                "status" => "duplicados",
                "message" => $mensaje,
                "duplicados" => $duplicados
            ]);
            return;
        }
    }

    // 3. Procesar y guardar archivo
    if (isset($_FILES['archivo']) && $_FILES['archivo']['error'] === 0) {
        $nombreArchivo = basename($_FILES['archivo']['name']);
        $rutaTemporal = $_FILES['archivo']['tmp_name'];

        $directorioDestino = __DIR__ . "/../imgPosters/";
        if (!file_exists($directorioDestino)) {
            mkdir($directorioDestino, 0777, true);
        }

        $rutaFinal = $directorioDestino . $nombreArchivo;

        if (move_uploaded_file($rutaTemporal, $rutaFinal)) {
            $rutaRelativa = "src/assets/imgPosters/" . $nombreArchivo;

            // --- INICIO DE ASIGNACIÓN AUTOMÁTICA DE ESPACIO FÍSICO ---
            $sqlEvento = "SELECT id_evento FROM eventos WHERE activo = 1 LIMIT 1";
            $resEvento = mysqli_query($conexion, $sqlEvento);
            $id_evento_activo = 1;
            if ($resEvento && $rowEv = mysqli_fetch_assoc($resEvento)) {
                $id_evento_activo = intval($rowEv['id_evento']);
            }

            $sqlEspacioLibre = "
                SELECT e.id_espacio, e.capacidad, COUNT(p.id) AS ocupados 
                FROM espacios_fisicos e 
                LEFT JOIN cargar_posters p ON e.id_espacio = p.id_espacio AND p.activo = 1 
                WHERE e.id_evento = $id_evento_activo 
                GROUP BY e.id_espacio 
                HAVING ocupados < e.capacidad 
                LIMIT 1";

            $resEspacio = mysqli_query($conexion, $sqlEspacioLibre);
            $id_espacio_asignado = "NULL";

            if ($resEspacio && $espacioDisp = mysqli_fetch_assoc($resEspacio)) {
                $id_espacio_asignado = intval($espacioDisp['id_espacio']);
            }
            // --- FIN DE ASIGNACIÓN AUTOMÁTICA ---

            // 4. Inserción con el espacio físico asignado
            $insertarDatos = "INSERT INTO `cargar_posters`
                (`titulo`, `autores`, `descripcion`, `categoria`, `palabrasClave`, `ruta_imagen`, `id_usuario`, `id_espacio`) 
                VALUES ('$titulo_escapado', '$autores_escapado', '$descripcion_escapada', '$categoria_escapada', '$palabrasClave_escapadas', '$rutaRelativa', $id_usuario, $id_espacio_asignado)";

            try {
                $ok = mysqli_query($conexion, $insertarDatos);
                if (!$ok) {
                    throw new Exception(mysqli_error($conexion));
                }
                // Obtener datos del usuario para enviar correo de confirmación
                $sqlUsuario = "SELECT nombres, apellidos, correo FROM usuario WHERE id = ?";
                $stmtUsr = $conexion->prepare($sqlUsuario);
                $stmtUsr->bind_param("i", $id_usuario);
                $stmtUsr->execute();
                $resUsr = $stmtUsr->get_result();
                if ($rowUsr = $resUsr->fetch_assoc()) {
                    $nombreCompleto = $rowUsr['nombres'] . ' ' . $rowUsr['apellidos'];
                    $destSub = $rowUsr['correo'];
                    $asuntoSub = "Registro exitoso de tu póster";
                    $mensajeSub = "
                        <h2>¡Hola, {$nombreCompleto}!</h2>
                        <p>Tu póster titulado <strong>'{$titulo}'</strong> ha sido cargado correctamente en la plataforma y se encuentra registrado con éxito.</p>
                        <p>Te notificaremos cuando sea asignado a evaluadores o reciba actualizaciones.</p>
                    ";
                }
                $stmtUsr->close();

                responderJsonYNotificar(["status" => "success", "message" => "Póster registrado y guardado exitosamente"], $destSub ?? null, $asuntoSub ?? null, $mensajeSub ?? null);
                return;
            } catch (Throwable $e) {
                // Si el archivo ya se movió pero el INSERT falló, eliminarlo para no dejar basura
                if (isset($rutaFinal) && file_exists($rutaFinal)) {
                    @unlink($rutaFinal);
                }
                // FK típica: id_usuario no existe en la tabla usuario
                if (str_contains($e->getMessage(), 'foreign key') || str_contains($e->getMessage(), 'fk_poster_usuario')) {
                    echo json_encode(["status" => "error", "message" => "Tu sesión tiene un usuario inválido (id=$id_usuario). Cierra sesión e inicia de nuevo."]);
                } else {
                    echo json_encode(["status" => "error", "message" => "Error al guardar: " . $e->getMessage()]);
                }
            }
        } else {
            echo json_encode(["status" => "error", "message" => "No se pudo mover el archivo"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "No se recibió archivo válido"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Método inválido"]);
}
?>