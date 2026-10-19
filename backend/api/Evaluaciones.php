<?php
// backend/api/Evaluaciones.php — evaluaciones por ronda.
//
// GET  (requiere sesión): detalle de criterios calificados de un póster.
// POST (requiere rol evaluador / admin / super admin): guarda o actualiza la
//      evaluación de un póster EN UNA RONDA.
//
// Seguridad:
//   * El id_evaluador SIEMPRE es el del token ($auth['id']); se ignora el que
//     envíe el cliente (así se evita la suplantación documentada en
//     SEGURIDAD-CAMBIOS.txt).
//   * Se relee el estado de la ronda dentro de la transacción: una ronda
//     cerrada no acepta cambios aunque el cliente muestre otro estado.
//   * Un evaluador no puede calificar un póster del que es autor, ni un póster
//     no asignado / no elegible (regla única en includes/RondasHelper.php).
//   * Prepared statements; los errores técnicos solo van al log.

include_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/RondasHelper.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        obtenerEvaluacionesDinamicas();
        break;
    case 'POST':
        guardarEvaluacionDinamica();
        break;
    default:
        rh_error(405, 'Método no permitido.', 'metodo_no_permitido');
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function obtenerEvaluacionesDinamicas()
{
    global $conexion;
    $auth = require_login();

    // Lote: varios pósters en una sola petición (evita el N+1 del front).
    if (isset($_GET['ids']) && trim((string)$_GET['ids']) !== '') {
        obtenerEvaluacionesLote($auth);
        return;
    }

    $id_poster = isset($_GET['id_poster']) ? intval($_GET['id_poster']) : 0;
    $id_evaluador = isset($_GET['id_evaluador']) ? intval($_GET['id_evaluador']) : 0;
    $id_ronda = isset($_GET['id_ronda']) ? intval($_GET['id_ronda']) : 0;

    if ($id_poster <= 0) rh_error(400, 'Debes indicar el póster a consultar.', 'parametros_invalidos');

    $propietario = intval($auth['id']);
    $esAdmin = in_array(intval($auth['rol']), [3, 4], true);

    // Cada quien solo consulta lo suyo: sus propias notas o su propio póster.
    $duenoDelPoster = false;
    if ($id_evaluador > 0 && $id_evaluador !== $propietario && !$esAdmin) {
        rh_error(403, 'Solo puedes consultar tus propias calificaciones.', 'sin_permiso');
    }
    if ($id_evaluador === 0 && !$esAdmin) {
        $sql = "SELECT id_usuario FROM cargar_posters WHERE id = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("i", $id_poster);
        $stmt->execute();
        $fila = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $duenoDelPoster = $fila && intval($fila['id_usuario']) === $propietario;
        if (!$duenoDelPoster) {
            // Un evaluador puede ver lo que él mismo calificó de ese póster.
            $sql = "SELECT 1 FROM evaluaciones WHERE id_poster = ? AND id_evaluador = ? LIMIT 1";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ii", $id_poster, $propietario);
            $stmt->execute();
            $tiene = (bool)$stmt->get_result()->fetch_row();
            $stmt->close();
            if (!$tiene) {
                rh_error(403, 'No tienes permiso para ver las calificaciones de este póster.', 'sin_permiso');
            }
        }
    }

    // El dueño ve TODAS las evaluaciones de su póster; quien no es dueño,
    // solo las suyas (los admins ven todo).
    $id_consulta = 0;
    if ($id_evaluador > 0) {
        $id_consulta = $id_evaluador;
    } elseif (!$esAdmin && !$duenoDelPoster) {
        $id_consulta = $propietario;
    }

    $sql = "SELECT d.id_criterio, d.calificacion, d.observaciones, d.id_ronda,
                   c.nombre AS criterio, r.nombre AS nombre_ronda, r.estado AS estado_ronda, r.numero
            FROM evaluaciones_detalles d
            LEFT JOIN criterios_evaluacion c ON c.id = d.id_criterio
            LEFT JOIN rondas r ON r.id_ronda = d.id_ronda
            WHERE d.id_poster = ?";
    $tipos = "i";
    $params = [$id_poster];

    if ($id_consulta > 0) {
        $sql .= " AND d.id_evaluador = ?";
        $tipos .= "i";
        $params[] = $id_consulta;
    }
    if ($id_ronda > 0) {
        $sql .= " AND d.id_ronda = ?";
        $tipos .= "i";
        $params[] = $id_ronda;
    }
    $sql .= " ORDER BY d.id_ronda ASC, d.id_criterio ASC";

    $stmt = $conexion->prepare($sql);
    $stmt->bind_param($tipos, ...$params);
    $stmt->execute();
    $resultado = $stmt->get_result();

    $detalles = [];
    $observaciones = "";
    $promedio = null;
    $notaRonda = null;
    $estadoRonda = null;
    $nombreRonda = null;
    $suma = 0;
    $total = 0;
    while ($row = $resultado->fetch_assoc()) {
        $detalles[$row['id_criterio']] = floatval($row['calificacion']);
        if (!empty($row['observaciones'])) $observaciones = $row['observaciones'];
        if (floatval($row['calificacion']) > 0) {
            $suma += floatval($row['calificacion']);
            $total++;
        }
        $notaRonda = intval($row['id_ronda']);
        $estadoRonda = $row['estado_ronda'];
        $nombreRonda = $row['nombre_ronda'];
    }
    $stmt->close();
    if ($total > 0) $promedio = round($suma / $total, 2);

    echo json_encode([
        'success' => true,
        'evaluaciones' => $detalles,
        'observaciones' => $observaciones,
        'promedio' => $promedio,
        'id_ronda' => $notaRonda,
        'nombre_ronda' => $nombreRonda,
        'estado_ronda' => $estadoRonda,
    ]);
}

/**
 * Consulta de VARIOS pósters en una sola petición: `GET ?ids=1,2,3[&id_evaluador=][&id_ronda=]`.
 * Devuelve { resultados: { id_poster: <misma forma que la consulta individual> } }.
 * Mismas reglas de visibilidad que la consulta individual, aplicadas en lote.
 */
function obtenerEvaluacionesLote($auth)
{
    global $conexion;

    $ids = array_values(array_unique(array_filter(array_map('intval', explode(',', (string)$_GET['ids'])), function ($v) {
        return $v > 0;
    })));
    if (count($ids) === 0) rh_error(400, 'Debes indicar los pósters a consultar.', 'parametros_invalidos');
    if (count($ids) > 300) $ids = array_slice($ids, 0, 300); // tope de lote

    $id_evaluador = isset($_GET['id_evaluador']) ? intval($_GET['id_evaluador']) : 0;
    $id_ronda = isset($_GET['id_ronda']) ? intval($_GET['id_ronda']) : 0;

    $propietario = intval($auth['id']);
    $esAdmin = in_array(intval($auth['rol']), [3, 4], true);

    if ($id_evaluador > 0 && $id_evaluador !== $propietario && !$esAdmin) {
        rh_error(403, 'Solo puedes consultar tus propias calificaciones.', 'sin_permiso');
    }

    $idsSql = implode(',', $ids); // ya pasaron por intval()

    $sql = "SELECT d.id_poster, d.id_criterio, d.calificacion, d.observaciones, d.id_ronda,
                   r.nombre AS nombre_ronda, r.estado AS estado_ronda
            FROM evaluaciones_detalles d
            LEFT JOIN rondas r ON r.id_ronda = d.id_ronda";
    $tipos = "";
    $params = [];

    if ($id_evaluador > 0) {
        // Solo las notas de ese evaluador (permiso ya validado arriba).
        $sql .= " WHERE d.id_evaluador = ? AND d.id_poster IN ($idsSql)";
        $tipos .= "i";
        $params[] = $id_evaluador;
    } elseif ($esAdmin) {
        $sql .= " WHERE d.id_poster IN ($idsSql)";
    } else {
        // Usuario normal: todas las evaluaciones de SUS pósters, o solo su
        // propia nota cuando el póster es de otro autor.
        $sql .= " JOIN cargar_posters p ON p.id = d.id_poster
                  WHERE d.id_poster IN ($idsSql) AND (p.id_usuario = ? OR d.id_evaluador = ?)";
        $tipos .= "ii";
        $params[] = $propietario;
        $params[] = $propietario;
    }
    if ($id_ronda > 0) {
        $sql .= " AND d.id_ronda = ?";
        $tipos .= "i";
        $params[] = $id_ronda;
    }
    $sql .= " ORDER BY d.id_poster ASC, d.id_ronda ASC, d.id_criterio ASC";

    $stmt = $conexion->prepare($sql);
    if (!$stmt) rh_error(500, 'No fue posible consultar las evaluaciones.', 'error_servidor');
    if ($tipos !== "") $stmt->bind_param($tipos, ...$params);
    $stmt->execute();
    $resultado = $stmt->get_result();

    $agrupado = [];
    while ($row = $resultado->fetch_assoc()) {
        $idp = intval($row['id_poster']);
        if (!isset($agrupado[$idp])) {
            $agrupado[$idp] = [
                'detalles' => [],
                'observaciones' => '',
                'suma' => 0,
                'total' => 0,
                'id_ronda' => null,
                'nombre_ronda' => null,
                'estado_ronda' => null,
            ];
        }
        $agrupado[$idp]['detalles'][$row['id_criterio']] = floatval($row['calificacion']);
        if (!empty($row['observaciones'])) $agrupado[$idp]['observaciones'] = $row['observaciones'];
        if (floatval($row['calificacion']) > 0) {
            $agrupado[$idp]['suma'] += floatval($row['calificacion']);
            $agrupado[$idp]['total']++;
        }
        $agrupado[$idp]['id_ronda'] = intval($row['id_ronda']);
        $agrupado[$idp]['nombre_ronda'] = $row['nombre_ronda'];
        $agrupado[$idp]['estado_ronda'] = $row['estado_ronda'];
    }
    $stmt->close();

    $resultados = [];
    foreach ($ids as $idp) {
        $g = $agrupado[$idp] ?? null;
        $resultados[$idp] = [
            'success' => true,
            'evaluaciones' => $g ? $g['detalles'] : [],
            'observaciones' => $g ? $g['observaciones'] : '',
            'promedio' => ($g && $g['total'] > 0) ? round($g['suma'] / $g['total'], 2) : null,
            'id_ronda' => $g ? $g['id_ronda'] : null,
            'nombre_ronda' => $g ? $g['nombre_ronda'] : null,
            'estado_ronda' => $g ? $g['estado_ronda'] : null,
        ];
    }

    echo json_encode(['success' => true, 'resultados' => $resultados]);
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

function guardarEvaluacionDinamica()
{
    global $conexion;

    // Identidad SIEMPRE desde el token.
    $auth = require_role([2, 3, 4]);
    $id_evaluador = intval($auth['id']);

    // Anti fuerza-bruta / anti automatización del envío de correos.
    if (!auth_rate_limit('guardar_evaluacion_' . $id_evaluador, 30, 300)) {
        rh_error(429, 'Demasiadas calificaciones en poco tiempo. Intenta de nuevo en unos minutos.', 'limite_peticiones');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) rh_error(400, 'El cuerpo de la petición no es válido.', 'parametros_invalidos');

    $id_poster = intval($data['id_poster'] ?? 0);
    $criterios = $data['criterios'] ?? [];
    $observaciones = trim((string)($data['observaciones'] ?? ''));

    if ($id_poster <= 0) rh_error(400, 'Debes indicar el póster a calificar.', 'parametros_invalidos');
    if (!is_array($criterios) || count($criterios) === 0) {
        rh_error(400, 'Debes enviar al menos un criterio calificado.', 'parametros_invalidos');
    }

    // Datos del póster y de la ronda.
    $sql = "SELECT p.id, p.titulo, p.id_evento, p.id_usuario, u.correo,
                   CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor
            FROM cargar_posters p
            JOIN usuario u ON u.id = p.id_usuario
            WHERE p.id = ? AND p.activo = 1";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_poster);
    $stmt->execute();
    $poster = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$poster) rh_error(404, 'No se encontró el póster indicado.', 'poster_no_encontrado');

    $id_ronda = intval($data['id_ronda'] ?? 0);
    if ($id_ronda <= 0) {
        rh_error(400, 'Debes indicar la ronda de evaluación (id_ronda).', 'parametros_invalidos');
    }
    $ronda = rh_ronda($conexion, $id_ronda);
    if (!$ronda) rh_error(404, 'No se encontró la ronda de evaluación.', 'ronda_no_encontrada');
    if (intval($ronda['id_evento']) !== intval($poster['id_evento'])) {
        $stmtPE = $conexion->prepare("SELECT 1 FROM poster_eventos WHERE id_poster = ? AND id_evento = ? LIMIT 1");
        $enPosterEventos = false;
        if ($stmtPE) {
            $idEvRonda = intval($ronda['id_evento']);
            $stmtPE->bind_param("ii", $id_poster, $idEvRonda);
            $stmtPE->execute();
            $enPosterEventos = (bool)$stmtPE->get_result()->fetch_row();
            $stmtPE->close();
        }
        if (!$enPosterEventos) {
            rh_error(400, 'La ronda indicada no pertenece al evento de este póster.', 'parametros_invalidos');
        }
    }
    $id_ronda = intval($ronda['id_ronda']);

    // Reglas de elegibilidad (una sola implementación, en RondasHelper.php).
    $elegibilidad = rh_elegibilidad($conexion, $id_evaluador, $ronda, $id_poster);
    if (!$elegibilidad['puede']) {
        $codigo = (strpos($elegibilidad['motivo'], 'propio póster') !== false) ? 403 : 403;
        rh_error($codigo, $elegibilidad['motivo'], 'sin_permiso');
    }

    // Los criterios deben pertenecer a la ronda y la nota va de 1.0 a 5.0.
    $notaMinima = 1.0;
    $notaMaxima = 5.0;

    $idsCriterios = [];
    foreach ($criterios as $id_criterio => $nota) {
        $idsCriterios[] = intval($id_criterio);
    }
    $idsCriterios = array_values(array_filter($idsCriterios, function ($v) { return $v > 0; }));
    if (count($idsCriterios) === 0) {
        rh_error(400, 'Los criterios enviados no son válidos.', 'parametros_invalidos');
    }
    $idsSql = implode(',', $idsCriterios); // ya pasaron por intval()

    $stmt = $conexion->prepare("SELECT id, nombre FROM criterios_evaluacion WHERE id IN ($idsSql) AND id_ronda = ? AND activo = 1");
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resultado = $stmt->get_result();
    $nombresCriterios = [];
    while ($rowNombre = $resultado->fetch_assoc()) {
        $nombresCriterios[intval($rowNombre['id'])] = $rowNombre['nombre'];
    }
    $stmt->close();

    foreach ($criterios as $id_criterio => $nota) {
        $id_crit = intval($id_criterio);
        $nombreCrit = $nombresCriterios[$id_crit] ?? null;

        if ($nombreCrit === null) {
            rh_error(400, 'Uno de los criterios enviados no pertenece a esta ronda.', 'criterio_invalido');
        }
        if (!is_numeric($nota)) {
            rh_error(400, "El criterio \"{$nombreCrit}\" no tiene una nota válida. La nota mínima es {$notaMinima} y la máxima es {$notaMaxima}.", 'nota_invalida');
        }
        $val_nota = floatval($nota);
        if ($val_nota < $notaMinima || $val_nota > $notaMaxima) {
            rh_error(400, "El criterio \"{$nombreCrit}\" tiene una nota de {$val_nota}. La nota mínima es {$notaMinima} y la máxima es {$notaMaxima}.", 'nota_invalida');
        }
    }

    try {
        $conexion->begin_transaction();

        // Releer el estado de la ronda DENTRO de la transacción: si ya la
        // cerraron, no se guarda nada (evita carreras entre admin y evaluador).
        $stmt = $conexion->prepare("SELECT estado FROM rondas WHERE id_ronda = ? FOR UPDATE");
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        $filaRonda = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$filaRonda) {
            $conexion->rollback();
            rh_error(404, 'No se encontró la ronda de evaluación.', 'ronda_no_encontrada');
        }
        if ($filaRonda['estado'] !== 'abierta') {
            $conexion->rollback();
            rh_error(409, 'La ronda está cerrada: sus evaluaciones ya no se pueden modificar.', 'ronda_cerrada');
        }

        $sql = "INSERT INTO evaluaciones_detalles (id_poster, id_ronda, id_evaluador, id_criterio, calificacion, observaciones)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    calificacion = VALUES(calificacion),
                    observaciones = VALUES(observaciones)";
        $stmt = $conexion->prepare($sql);

        $sumaNotas = 0;
        $totalCriterios = 0;
        foreach ($criterios as $id_criterio => $nota) {
            $id_crit = intval($id_criterio);
            $val_nota = floatval($nota);
            $stmt->bind_param("iiiids", $id_poster, $id_ronda, $id_evaluador, $id_crit, $val_nota, $observaciones);
            $stmt->execute();
            $sumaNotas += $val_nota;
            $totalCriterios++;
        }
        $stmt->close();

        $promedioFinal = $totalCriterios > 0 ? round($sumaNotas / $totalCriterios, 2) : 0;

        // Registro legacy: se recalcula con el promedio de esta ronda.
        $sql = "INSERT INTO evaluaciones (id_poster, id_ronda, id_evaluador, promedio_total, observaciones, fecha_evaluacion)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    promedio_total = VALUES(promedio_total),
                    observaciones = VALUES(observaciones),
                    fecha_evaluacion = NOW()";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("iiids", $id_poster, $id_ronda, $id_evaluador, $promedioFinal, $observaciones);
        $stmt->execute();
        $stmt->close();

        $conexion->commit();
    } catch (Exception $e) {
        $conexion->rollback();
        rh_log('guardar_evaluacion: ' . $e->getMessage());
        rh_error(500, 'No fue posible guardar la evaluación. No se guardó ningún cambio.', 'error_servidor');
    }

    // Aviso al autor del póster (solo a su correo registrado).
    $destEval = null;
    $asunto = null;
    $mensaje = null;
    if (!empty($poster['correo'])) {
        $tituloEscapado = rh_escapar($poster['titulo']);
        $observacionesEscapadas = rh_escapar($observaciones);
        $nombreAutor = rh_escapar($poster['nombre_autor']);
        $asunto = "¡Tu póster ha sido evaluado!";
        $mensaje = rh_plantilla_correo('¡Tu póster ha sido evaluado!', "
            <p>¡Hola, <strong>{$nombreAutor}</strong>!</p>
            <p>Tu póster titulado <strong>'{$tituloEscapado}'</strong> ha recibido una nueva calificación en la <strong>" . rh_escapar($ronda['nombre']) . "</strong>.</p>
            <div style='background:#f5f7f8; padding:15px; border-radius:8px; border:1px solid #e2e8ec; margin:15px 0;'>
                <p style='margin:0 0 10px 0;'><strong>Promedio obtenido:</strong> <span style='color:#00acc9; font-size:1.2em;'>{$promedioFinal} / 5.0</span></p>
                <p style='margin:0;'><strong>Observaciones del evaluador:</strong> {$observacionesEscapadas}</p>
            </div>
            <p>Puedes ingresar a la plataforma para ver el detalle de los criterios.</p>");
        $destEval = $poster['correo'];
    }

    // Responder primero para no hacer esperar a la UI; el correo sale después.
    responderJsonYNotificar([
        'success' => true,
        'message' => 'Evaluación registrada correctamente',
        'promedio' => $promedioFinal,
        'id_ronda' => $id_ronda,
    ], $destEval, $asunto, $mensaje);
}
?>
