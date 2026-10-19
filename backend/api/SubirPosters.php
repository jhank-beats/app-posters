<?php
// backend/api/SubirPosters.php — Fase 2:
//   - GET (?action=profesores): devuelve la lista de profesores disponibles.
//   - POST: valida sesión (Auth.php), detecta duplicados difusos y por SHA-256
//     dentro del evento activo, persiste id_evento y hash_archivo, guarda
//     profesores/materias en `poster_profesores` y asigna evaluadores al azar.

require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/PostersHelper.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Lista de profesores para el selector múltiple del formulario de subir/editar póster.
    $profesores = ph_obtener_profesores_disponibles($conexion);
    echo json_encode([
        'success' => true,
        'status' => 'success',
        'data' => $profesores,
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Método inválido']);
    exit;
}

// Exigir sesión autenticada (roles 1=usuario, 2=evaluador, 3=admin, 4=super_admin).
$auth = require_role([1, 2, 3, 4]);
$id_usuario = intval($auth['id']);

$titulo = trim((string)($_POST['titulo'] ?? ''));
$autores = trim((string)($_POST['autores'] ?? ''));
$descripcion = trim((string)($_POST['descripcion'] ?? ''));
$categoria = trim((string)($_POST['categoria'] ?? ''));
$palabrasClave = trim((string)($_POST['palabrasClave'] ?? ''));

$forzarRaw = $_POST['forzar_guardado'] ?? 'false';
$forzar_guardado = ($forzarRaw === 'true' || $forzarRaw === '1' || $forzarRaw === true);

if ($id_usuario <= 0) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'ID de usuario no válido']);
    exit;
}

if ($titulo === '' || $autores === '' || $descripcion === '' || $categoria === '' || $palabrasClave === '') {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'Todos los campos principales del póster son obligatorios.']);
    exit;
}

if (mb_strlen($descripcion, 'UTF-8') > 255) {
    echo json_encode([
        'status' => 'error',
        'success' => false,
        'message' => 'La descripción no puede superar los 255 caracteres (actual: ' . mb_strlen($descripcion, 'UTF-8') . ').',
    ]);
    exit;
}

if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['status' => 'error', 'success' => false, 'message' => 'No se recibió un archivo válido.']);
    exit;
}

$rutaTemporal = $_FILES['archivo']['tmp_name'];
$nombreOriginal = basename($_FILES['archivo']['name']);
$hashArchivo = is_file($rutaTemporal) ? hash_file('sha256', $rutaTemporal) : null;

// Normalizar pares profesor-materia enviados desde el formulario
$paresProfesores = ph_normalizar_pares_profesores(
    $_POST['profesores'] ?? null,
    $_POST['materias'] ?? null,
    $_POST['profesores_materias'] ?? null
);

// Resolver la carrera de participación ('sistemas', 'civil' o 'ambas') y los eventos activos correspondientes
$carreraParticipacion = isset($_POST['carrera_participacion']) && trim((string)$_POST['carrera_participacion']) !== ''
    ? ph_normalizar_carrera($_POST['carrera_participacion'])
    : null;

if (!$carreraParticipacion) {
    $stmtCar = $conexion->prepare("SELECT carrera FROM usuario WHERE id = ? LIMIT 1");
    if ($stmtCar) {
        $stmtCar->bind_param("i", $id_usuario);
        $stmtCar->execute();
        if ($filaCar = $stmtCar->get_result()->fetch_assoc()) {
            $carreraParticipacion = ph_normalizar_carrera($filaCar['carrera'] ?? 'sistemas');
        }
        $stmtCar->close();
    }
    if (!$carreraParticipacion) {
        $carreraParticipacion = 'sistemas';
    }
}

$idsEventosParticipantes = [];
if (isset($_POST['id_evento']) && intval($_POST['id_evento']) > 0 && $carreraParticipacion !== 'ambas') {
    $idsEventosParticipantes = [intval($_POST['id_evento'])];
} else {
    $idsEventosParticipantes = ph_eventos_activos_para_carrera($conexion, $carreraParticipacion);
}
$id_evento_activo = intval($idsEventosParticipantes[0] ?? ph_evento_activo($conexion));

$archivoMovido = false;
$rutaFinal = null;
$yaExistiaEnDisco = false;

try {
    $conexion->begin_transaction();

    // 1. Detección de duplicados difusos y por hash en el evento activo (dentro de la transacción)
    if (!$forzar_guardado) {
        $chequeo = ph_detectar_duplicados($conexion, [
            'titulo' => $titulo,
            'descripcion' => $descripcion,
            'autores' => $autores,
            'palabrasClave' => $palabrasClave,
            'hash_archivo' => $hashArchivo,
            'id_evento' => $id_evento_activo,
            'excluir_id' => 0,
            'bloquear_filas' => true,
        ]);

        if ($chequeo['hay_duplicados']) {
            $conexion->rollback();
            echo json_encode([
                'status' => 'duplicados',
                'success' => false,
                'message' => $chequeo['mensaje'],
                'duplicados' => $chequeo['duplicados'],
            ]);
            exit;
        }
    }

    // 2. Mover el archivo subido al directorio destino
    $directorioDestino = __DIR__ . '/../imgPosters/';
    if (!file_exists($directorioDestino)) {
        mkdir($directorioDestino, 0777, true);
    }

    $rutaFinal = $directorioDestino . $nombreOriginal;
    $yaExistiaEnDisco = file_exists($rutaFinal);

    if (!move_uploaded_file($rutaTemporal, $rutaFinal)) {
        $conexion->rollback();
        echo json_encode(['status' => 'error', 'success' => false, 'message' => 'No se pudo guardar el archivo del póster en el servidor.']);
        exit;
    }
    $archivoMovido = true;
    $rutaRelativa = 'src/assets/imgPosters/' . $nombreOriginal;

    // 3. Asignación automática de espacio físico con cupo disponible en el evento
    $id_espacio_asignado = null;
    $sqlEspacioLibre = "
        SELECT e.id_espacio, e.capacidad, COUNT(p.id) AS ocupados
        FROM espacios_fisicos e
        LEFT JOIN cargar_posters p ON e.id_espacio = p.id_espacio AND p.activo = 1
        WHERE e.id_evento = ?
        GROUP BY e.id_espacio, e.capacidad
        HAVING ocupados < e.capacidad
        ORDER BY e.id_espacio ASC
        LIMIT 1";
    $stmtEsp = $conexion->prepare($sqlEspacioLibre);
    if ($stmtEsp) {
        $stmtEsp->bind_param("i", $id_evento_activo);
        $stmtEsp->execute();
        $resEsp = $stmtEsp->get_result();
        if ($espacioDisp = $resEsp->fetch_assoc()) {
            $id_espacio_asignado = intval($espacioDisp['id_espacio']);
        }
        $stmtEsp->close();
    }

    // 4. Insertar el póster con prepared statement (incluyendo id_evento y hash_archivo)
    $sqlInsert = "INSERT INTO cargar_posters
        (titulo, autores, descripcion, categoria, palabrasClave, ruta_imagen, hash_archivo, id_usuario, id_evento, id_espacio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmtIns = $conexion->prepare($sqlInsert);
    if (!$stmtIns) {
        throw new Exception('No se pudo preparar el registro del póster: ' . $conexion->error);
    }
    $stmtIns->bind_param(
        "sssssssiii",
        $titulo,
        $autores,
        $descripcion,
        $categoria,
        $palabrasClave,
        $rutaRelativa,
        $hashArchivo,
        $id_usuario,
        $id_evento_activo,
        $id_espacio_asignado
    );
    if (!$stmtIns->execute()) {
        $err = $stmtIns->error;
        $stmtIns->close();
        throw new Exception($err);
    }
    $id_poster_nuevo = intval($conexion->insert_id);
    $stmtIns->close();

    // 4.1 Registrar en la tabla puente `poster_eventos` (Sistemas, Civil o Ambas)
    ph_sincronizar_poster_eventos($conexion, $id_poster_nuevo, $idsEventosParticipantes);

    // 5. Persistir profesores y materias en `poster_profesores`
    $profesoresGuardados = ph_guardar_profesores_poster($conexion, $id_poster_nuevo, $paresProfesores);
    $idsProfesores = array_map(function ($item) {
        return intval($item['id_usuario']);
    }, $profesoresGuardados);

    // 6. Asignación aleatoria automática de evaluador(es) para la Ronda 1 de cada evento participante
    $evaluadoresAsignadosTotal = [];
    $notificacionesAsignacionTotal = [];
    foreach ($idsEventosParticipantes as $idEvPart) {
        $resEvAsig = ph_asignar_evaluadores_al_subir(
            $conexion,
            $id_poster_nuevo,
            intval($idEvPart),
            $id_usuario,
            $titulo,
            $categoria,
            $idsProfesores,
            $id_espacio_asignado,
            1
        );
        if (!empty($resEvAsig['evaluadores'])) {
            foreach ($resEvAsig['evaluadores'] as $evAsig) {
                $evaluadoresAsignadosTotal[] = $evAsig;
            }
        }
        if (!empty($resEvAsig['notificaciones'])) {
            foreach ($resEvAsig['notificaciones'] as $notifEv) {
                $notificacionesAsignacionTotal[] = $notifEv;
            }
        }
    }
    $resultadoAsignacion = [
        'evaluadores' => $evaluadoresAsignadosTotal,
        'notificaciones' => $notificacionesAsignacionTotal,
    ];

    $conexion->commit();

    // 7. Correo de confirmación al autor + correos a los evaluadores asignados
    $destSub = null;
    $asuntoSub = null;
    $mensajeSub = null;
    $stmtUsr = $conexion->prepare("SELECT nombres, apellidos, correo FROM usuario WHERE id = ?");
    if ($stmtUsr) {
        $stmtUsr->bind_param("i", $id_usuario);
        $stmtUsr->execute();
        $resUsr = $stmtUsr->get_result();
        if ($rowUsr = $resUsr->fetch_assoc()) {
            $nombreCompleto = rh_escapar($rowUsr['nombres'] . ' ' . $rowUsr['apellidos']);
            $tituloEsc = rh_escapar($titulo);
            $destSub = $rowUsr['correo'];
            $asuntoSub = "Registro exitoso de tu póster";
            $cuerpoAutor = "
                <p>¡Hola, <strong>{$nombreCompleto}</strong>!</p>
                <p>Tu póster titulado <strong>'{$tituloEsc}'</strong> ha sido cargado y registrado exitosamente en la plataforma (" . rh_escapar(ph_etiqueta_carrera($carreraParticipacion)) . ").</p>
                <p>El sistema ya asignó evaluador(es) para la primera ronda. Te notificaremos cuando reciba actualizaciones.</p>
            ";
            $mensajeSub = function_exists('rh_plantilla_correo')
                ? rh_plantilla_correo('Póster registrado con éxito', $cuerpoAutor)
                : $cuerpoAutor;
        }
        $stmtUsr->close();
    }

    $respuesta = [
        'status' => 'success',
        'success' => true,
        'message' => 'Póster registrado y guardado exitosamente',
        'poster' => [
            'id' => $id_poster_nuevo,
            'titulo' => $titulo,
            'id_evento' => $id_evento_activo,
            'ids_eventos' => $idsEventosParticipantes,
            'carrera_participacion' => $carreraParticipacion,
            'id_espacio' => $id_espacio_asignado,
            'profesores' => $profesoresGuardados,
            'evaluadores_asignados' => $resultadoAsignacion['evaluadores'],
        ],
    ];

    if (ob_get_length()) {
        ob_clean();
    }
    echo json_encode($respuesta);

    if ($destSub && $asuntoSub && $mensajeSub) {
        encolarCorreoFondo($destSub, $asuntoSub, $mensajeSub);
    }
    foreach ($resultadoAsignacion['notificaciones'] as $notif) {
        encolarCorreoFondo($notif['correo'], $notif['asunto'], $notif['mensaje']);
    }
    exit;

} catch (Throwable $e) {
    @$conexion->rollback();
    if ($archivoMovido && !$yaExistiaEnDisco && $rutaFinal && file_exists($rutaFinal)) {
        @unlink($rutaFinal);
    }
    if (str_contains($e->getMessage(), 'foreign key') || str_contains($e->getMessage(), 'fk_poster_usuario')) {
        echo json_encode([
            'status' => 'error',
            'success' => false,
            'message' => "Tu sesión tiene un usuario inválido (id={$id_usuario}). Cierra sesión e inicia de nuevo.",
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'success' => false,
            'message' => 'Error al guardar: ' . $e->getMessage(),
        ]);
    }
    exit;
}
?>