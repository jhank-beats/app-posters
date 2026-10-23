<?php
// includes/RondasHelper.php
// Lógica compartida de rondas de evaluación y premios.
//
// Esta es la ÚNICA implementación de las reglas de elegibilidad (§5.3 del
// documento de especificación): la usan Rondas.php, Evaluaciones.php,
// TablaPosters.php y Notificaciones.php para no duplicar reglas ni dejar que
// el front decida permisos.
//
// Toda la identidad llega por token (Auth.php). Ninguna función de aquí acepta
// "quién soy" por parámetro del cliente: el id que se recibe es siempre el de
// $auth['id'] o un id de recurso (póster / ronda) que se valida en el servidor.

// ---------------------------------------------------------------------------
// Respuestas y utilidades
// ---------------------------------------------------------------------------

function rh_escapar($texto)
{
    return htmlspecialchars((string)$texto, ENT_QUOTES, 'UTF-8');
}

// Mensaje de error al cliente: nunca se filtra el error técnico (va al log).
function rh_error($codigo, $mensaje, $tipo = 'error', $extra = [])
{
    http_response_code($codigo);
    echo json_encode(array_merge([
        'success' => false,
        'status' => 'error',
        'tipo' => $tipo,
        'message' => $mensaje,
    ], $extra));
    exit;
}

function rh_exito($datos = [], $mensaje = null)
{
    $respuesta = array_merge(['success' => true, 'status' => 'success'], $datos);
    if ($mensaje !== null) $respuesta['message'] = $mensaje;
    echo json_encode($respuesta);
    exit;
}

function rh_log($detalle)
{
    error_log('[Rondas] ' . $detalle);
}

// ---------------------------------------------------------------------------
// Consultas base de rondas
// ---------------------------------------------------------------------------

function rh_ronda($conexion, $id_ronda)
{
    $id_ronda = intval($id_ronda);
    if ($id_ronda <= 0) return null;
    $sql = "SELECT r.*, ev.nombre_evento, ev.codigo_evento
            FROM rondas r
            JOIN eventos ev ON ev.id_evento = r.id_evento
            WHERE r.id_ronda = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $fila ?: null;
}

function rh_ronda_por_numero($conexion, $id_evento, $numero)
{
    $id_evento = intval($id_evento);
    $numero = intval($numero);
    if ($id_evento <= 0 || $numero <= 0) return null;
    $sql = "SELECT r.*, ev.nombre_evento, ev.codigo_evento
            FROM rondas r
            JOIN eventos ev ON ev.id_evento = r.id_evento
            WHERE r.id_evento = ? AND r.numero = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("ii", $id_evento, $numero);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $fila ?: null;
}

// Ronda exigida o 404 en español.
function rh_exigir_ronda($conexion, $id_ronda)
{
    $ronda = rh_ronda($conexion, $id_ronda);
    if (!$ronda) {
        rh_error(404, 'No se encontró la ronda indicada.', 'ronda_no_encontrada');
    }
    return $ronda;
}

// Ronda siguiente del mismo evento (la que recibe a los pósters del corte).
function rh_ronda_siguiente($conexion, $id_ronda)
{
    $ronda = rh_ronda($conexion, $id_ronda);
    if (!$ronda) return null;
    return rh_ronda_por_numero($conexion, $ronda['id_evento'], intval($ronda['numero']) + 1);
}

// ---------------------------------------------------------------------------
// Reglas de elegibilidad (§5.3) — una sola implementación
// ---------------------------------------------------------------------------

// ¿Participó el evaluador en la ronda? ⇔ tiene >= 1 evaluación guardada en ella.
function rh_participo_en_ronda($conexion, $id_evaluador, $id_ronda)
{
    $id_evaluador = intval($id_evaluador);
    $id_ronda = intval($id_ronda);
    if ($id_evaluador <= 0 || $id_ronda <= 0) return false;
    $sql = "SELECT 1 FROM evaluaciones WHERE id_evaluador = ? AND id_ronda = ? LIMIT 1";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("ii", $id_evaluador, $id_ronda);
    $stmt->execute();
    $existe = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    return $existe;
}

// ¿Es el usuario el autor del póster? (conflicto de intereses)
function rh_es_autor_poster($conexion, $id_poster, $id_usuario)
{
    $id_poster = intval($id_poster);
    $id_usuario = intval($id_usuario);
    if ($id_poster <= 0 || $id_usuario <= 0) return false;
    $sql = "SELECT id_usuario FROM cargar_posters WHERE id = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_poster);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $fila && intval($fila['id_usuario']) === $id_usuario;
}

// ¿Figura el usuario como profesor asignado del póster? (conflicto de intereses)
function rh_es_profesor_poster($conexion, $id_poster, $id_usuario)
{
    $id_poster = intval($id_poster);
    $id_usuario = intval($id_usuario);
    if ($id_poster <= 0 || $id_usuario <= 0) return false;
    $stmt = $conexion->prepare(
        "SELECT 1 FROM poster_profesores WHERE id_poster = ? AND id_usuario = ? LIMIT 1"
    );
    if (!$stmt) return false;
    $stmt->bind_param("ii", $id_poster, $id_usuario);
    $stmt->execute();
    $existe = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    return $existe;
}

// Ronda previa a la que se está evaluando (para la elegibilidad de la ronda 2+).
function rh_ronda_previa($conexion, $ronda)
{
    $numero = intval($ronda['numero']);
    if ($numero <= 1) return null;
    return rh_ronda_por_numero($conexion, $ronda['id_evento'], $numero - 1);
}

/**
 * Elegibilidad de un evaluador para calificar un póster en una ronda.
 * Devuelve ['puede' => bool, 'motivo' => 'texto en español'].
 *
 * Reglas (Fase 1):
 *  - Nadie evalúa su propio póster (conflicto de intereses).
 *  - Toda ronda (1, 2 o posterior): hay que estar asignado al póster
 *    en ESA ronda (asignaciones_evaluadores.id_ronda) Y el póster debe
 *    estar seleccionado para la ronda cuando numero > 1.
 *  - Ya NO se exige "haber participado en la ronda anterior": la R2 usa
 *    reasignación aleatoria con evaluadores nuevos.
 */
function rh_elegibilidad($conexion, $id_evaluador, $ronda, $id_poster)
{
    $id_evaluador = intval($id_evaluador);
    $id_poster = intval($id_poster);

    if ($id_evaluador <= 0 || $id_poster <= 0) {
        return ['puede' => false, 'motivo' => 'Datos incompletos para validar la evaluación.'];
    }

    if (rh_es_autor_poster($conexion, $id_poster, $id_evaluador)) {
        return ['puede' => false, 'motivo' => 'No puedes evaluar tu propio póster (conflicto de intereses).'];
    }

    if (rh_es_profesor_poster($conexion, $id_poster, $id_evaluador)) {
        return ['puede' => false, 'motivo' => 'No puedes evaluar un póster en el que figuras como profesor asignado (conflicto de intereses).'];
    }

    $id_ronda = intval($ronda['id_ronda']);

    // Ronda 2+: el póster debe estar seleccionado para esta ronda.
    if (intval($ronda['numero']) > 1) {
        $sql = "SELECT 1 FROM selecciones WHERE id_poster = ? AND id_ronda = ? LIMIT 1";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("ii", $id_poster, $id_ronda);
        $stmt->execute();
        $seleccionado = (bool)$stmt->get_result()->fetch_row();
        $stmt->close();
        if (!$seleccionado) {
            return ['puede' => false, 'motivo' => 'Este póster no fue seleccionado para esta ronda.'];
        }
    }

    // Toda ronda exige asignación explícita en ESA ronda.
    $sql = "SELECT 1 FROM asignaciones_evaluadores
            WHERE id_poster = ? AND id_evaluador = ? AND id_ronda = ? LIMIT 1";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("iii", $id_poster, $id_evaluador, $id_ronda);
    $stmt->execute();
    $asignado = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    if (!$asignado) {
        return ['puede' => false, 'motivo' => 'Este póster no te fue asignado en esta ronda.'];
    }

    // Ya calificó este póster antes (otra ronda del mismo evento): no se repite.
    $id_evento_ronda = intval($ronda['id_evento'] ?? 0);
    $sql = "SELECT 1 FROM evaluaciones e
            JOIN rondas r ON r.id_ronda = e.id_ronda
            WHERE e.id_poster = ? AND e.id_evaluador = ? AND e.id_ronda <> ? AND r.id_evento = ? LIMIT 1";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("iiii", $id_poster, $id_evaluador, $id_ronda, $id_evento_ronda);
    $stmt->execute();
    $yaCalifico = (bool)$stmt->get_result()->fetch_row();
    $stmt->close();
    if ($yaCalifico) {
        return ['puede' => false, 'motivo' => 'Ya calificaste este póster en una ronda anterior.', 'es_autor' => false];
    }

    return ['puede' => true, 'motivo' => ''];
}

/**
 * Elegibilidad de UN evaluador para TODOS los pósters de una ronda, con un
 * número FIJO de consultas (1 en la ronda 1, 3 en la ronda 2+) en vez de
 * 4-7 consultas por póster: el listado la usa para N pósters de una sola vez.
 *
 * $posters: mapa [id_poster => fila con 'id_usuario'], tal como lo arma
 * TablaPosters (la autoría se resuelve en memoria, sin volver a consultar).
 *
 * Devuelve [id_poster => ['puede' => bool, 'motivo' => string, 'es_autor' => bool]].
 * Las reglas y los mensajes son los mismos que rh_elegibilidad().
 */
function rh_elegibilidad_lote($conexion, $id_evaluador, $ronda, $posters)
{
    $id_evaluador = intval($id_evaluador);
    $resultado = [];
    if ($id_evaluador <= 0 || !$ronda) return $resultado;

    $esAutor = [];
    foreach ($posters as $id_poster => $fila) {
        $esAutor[intval($id_poster)] = isset($fila['id_usuario']) && intval($fila['id_usuario']) === $id_evaluador;
    }

    // Profesores asignados de ESTE evaluador entre los pósters del lote (1 consulta).
    $esProfesorDe = [];
    $idsPosters = array_map('intval', array_keys($posters));
    if (count($idsPosters) > 0) {
        $marcasProf = implode(',', $idsPosters);
        $stmtProf = $conexion->prepare(
            "SELECT id_poster FROM poster_profesores WHERE id_usuario = ? AND id_poster IN ($marcasProf)"
        );
        if ($stmtProf) {
            $stmtProf->bind_param("i", $id_evaluador);
            $stmtProf->execute();
            $resProf = $stmtProf->get_result();
            while ($fp = $resProf->fetch_assoc()) {
                $esProfesorDe[intval($fp['id_poster'])] = true;
            }
            $stmtProf->close();
        }
    }

    $id_ronda = intval($ronda['id_ronda']);
    $id_evento_ronda = intval($ronda['id_evento'] ?? 0);

    // Asignados en ESTA ronda (toda ronda lo exige).
    $asignados = [];
    $stmt = $conexion->prepare("SELECT id_poster FROM asignaciones_evaluadores WHERE id_evaluador = ? AND id_ronda = ?");
    $stmt->bind_param("ii", $id_evaluador, $id_ronda);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($fila = $res->fetch_assoc()) {
        $asignados[intval($fila['id_poster'])] = true;
    }
    $stmt->close();

    // Seleccionados (solo ronda 2+).
    $seleccionados = null;
    if (intval($ronda['numero']) > 1) {
        $seleccionados = [];
        $stmt = $conexion->prepare("SELECT id_poster FROM selecciones WHERE id_ronda = ?");
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($fila = $res->fetch_assoc()) {
            $seleccionados[intval($fila['id_poster'])] = true;
        }
        $stmt->close();
    }

    // Pósters ya calificados por este evaluador en OTRA ronda del mismo evento.
    $yaCalificados = [];
    $ids = array_map('intval', array_keys($posters));
    if (count($ids) > 0) {
        $marcas = implode(',', $ids);
        $sql = "SELECT DISTINCT e.id_poster FROM evaluaciones e
                JOIN rondas r ON r.id_ronda = e.id_ronda
                WHERE e.id_evaluador = ? AND e.id_ronda <> ? AND r.id_evento = ? AND e.id_poster IN ($marcas)";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("iii", $id_evaluador, $id_ronda, $id_evento_ronda);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($fila = $res->fetch_assoc()) {
            $yaCalificados[intval($fila['id_poster'])] = true;
        }
        $stmt->close();
    }

    foreach ($posters as $id_poster => $fila) {
        $id = intval($id_poster);
        if ($esAutor[$id]) {
            $resultado[$id] = ['puede' => false, 'motivo' => 'No puedes evaluar tu propio póster (conflicto de intereses).', 'es_autor' => true];
        } elseif (isset($esProfesorDe[$id])) {
            $resultado[$id] = ['puede' => false, 'motivo' => 'No puedes evaluar un póster en el que figuras como profesor asignado (conflicto de intereses).', 'es_autor' => false];
        } elseif ($seleccionados !== null && !isset($seleccionados[$id])) {
            $resultado[$id] = ['puede' => false, 'motivo' => 'Este póster no fue seleccionado para esta ronda.', 'es_autor' => false];
        } elseif (!isset($asignados[$id])) {
            $resultado[$id] = ['puede' => false, 'motivo' => 'Este póster no te fue asignado en esta ronda.', 'es_autor' => false];
        } elseif (isset($yaCalificados[$id])) {
            $resultado[$id] = ['puede' => false, 'motivo' => 'Ya calificaste este póster en una ronda anterior.', 'es_autor' => false];
        } else {
            $resultado[$id] = ['puede' => true, 'motivo' => '', 'es_autor' => false];
        }
    }
    return $resultado;
}

/**
 * Evaluadores de una ronda: asignados en ESA ronda con su avance.
 * Devuelve lista con n_asignados, n_calificados, n_pendientes y conflictos
 * (pósters de los que es autor). Fase 1: el admin la consume para ver
 * quién falta por calificar.
 */
function rh_participantes_ronda($conexion, $ronda)
{
    $id_ronda = intval($ronda['id_ronda']);

    // Evaluadores asignados en esta ronda.
    $sql = "SELECT u.id, u.nombres, u.apellidos, u.correo,
                   COUNT(DISTINCT a.id_poster) AS n_asignados
            FROM asignaciones_evaluadores a
            JOIN usuario u ON u.id = a.id_evaluador
            WHERE a.id_ronda = ? AND u.activo = 1
            GROUP BY u.id, u.nombres, u.apellidos, u.correo
            ORDER BY u.nombres ASC, u.apellidos ASC";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resultado = $stmt->get_result();
    $evaluadores = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id'] = intval($fila['id']);
        $fila['n_asignados'] = intval($fila['n_asignados']);
        $fila['n_evaluaciones_previa'] = $fila['n_asignados'];
        $fila['conflictos'] = [];
        $evaluadores[] = $fila;
    }
    $stmt->close();

    if (count($evaluadores) === 0) return $evaluadores;

    // Calificados por evaluador en esta ronda.
    $idsEv = array_map(function ($e) { return intval($e['id']); }, $evaluadores);
    $marcas = implode(',', $idsEv);
    $calificados = [];
    $sql = "SELECT id_evaluador, COUNT(DISTINCT id_poster) AS n FROM evaluaciones
            WHERE id_ronda = ? AND id_evaluador IN ($marcas) GROUP BY id_evaluador";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($fila = $res->fetch_assoc()) {
        $calificados[intval($fila['id_evaluador'])] = intval($fila['n']);
    }
    $stmt->close();

    // Pósters de la ronda y autor de cada uno, para marcar conflictos.
    $sql = "SELECT p.id AS id_poster, p.titulo, p.id_usuario
            FROM selecciones s
            JOIN cargar_posters p ON p.id = s.id_poster
            WHERE s.id_ronda = ? AND p.activo = 1
            ORDER BY p.titulo ASC";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resultado = $stmt->get_result();
    $posters = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id_poster'] = intval($fila['id_poster']);
        $fila['id_usuario'] = intval($fila['id_usuario']);
        $posters[] = $fila;
    }
    $stmt->close();

    // La ronda 1 no tiene "selecciones" propias: se muestran sus asignados.
    $numero = intval($ronda['numero']);
    if ($numero <= 1 && count($posters) === 0) {
        $sql = "SELECT p.id AS id_poster, p.titulo, p.id_usuario
                FROM asignaciones_evaluadores a
                JOIN cargar_posters p ON p.id = a.id_poster
                WHERE a.id_ronda = ? AND p.activo = 1
                ORDER BY p.titulo ASC";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        $resultado = $stmt->get_result();
        while ($fila = $resultado->fetch_assoc()) {
            $fila['id_poster'] = intval($fila['id_poster']);
            $fila['id_usuario'] = intval($fila['id_usuario']);
            $posters[] = $fila;
        }
        $stmt->close();
    }

    foreach ($evaluadores as $i => $ev) {
        $nCal = $calificados[$ev['id']] ?? 0;
        $evaluadores[$i]['n_calificados'] = $nCal;
        $evaluadores[$i]['n_pendientes'] = max(0, $ev['n_asignados'] - $nCal);
        foreach ($posters as $p) {
            if ($p['id_usuario'] === $ev['id']) {
                $evaluadores[$i]['conflictos'][] = [
                    'id_poster' => $p['id_poster'],
                    'titulo' => $p['titulo'],
                    'motivo' => 'Es el autor del póster',
                ];
            }
        }
        $evaluadores[$i]['n_conflictos'] = count($evaluadores[$i]['conflictos']);
        $evaluadores[$i]['elegibles'] = max(0, count($posters) - intval($evaluadores[$i]['n_conflictos']));
    }

    return $evaluadores;
}

// ---------------------------------------------------------------------------
// Ranking / estadísticas por ronda
// ---------------------------------------------------------------------------

/**
 * Estadísticas de todos los pósters activos del evento de la ronda:
 * promedio de la ronda, nº de evaluaciones, evaluadores esperados y la fila de
 * `selecciones` que corresponde a la ronda.
 *
 * Nota de una evaluación = promedio de `evaluaciones_detalles.calificacion` de
 * los criterios de esa ronda (2 decimales). Las calificaciones 0.00 son
 * registros históricos incompletos (la nota mínima es 1.0) y no se tienen en
 * cuenta. El promedio del póster se calcula en SQL, sin tabla intermedia.
 *
 * $id_ronda_sel: ronda cuyas `selecciones` se consultan. Para la ronda 1 es la
 * ronda siguiente (quién pasó el corte); para la ronda 2 en adelante, la propia
 * ronda (quién compite y qué lugar obtuvo).
 */
function rh_estadisticas_ronda($conexion, $ronda, $id_ronda_sel = null, $soloSeleccionados = false)
{
    $id_ronda = intval($ronda['id_ronda']);
    $id_evento = intval($ronda['id_evento']);
    $id_ronda_sel = $id_ronda_sel === null ? $id_ronda : intval($id_ronda_sel);
    $condicionSel = $soloSeleccionados ? "AND sel.id_seleccion IS NOT NULL" : "";

    $sql = "SELECT * FROM (
                SELECT
                    p.id AS id_poster,
                    p.titulo,
                    p.autores,
                    p.categoria,
                    p.id_usuario,
                    p.id_evento,
                    (SELECT CONCAT(u.nombres, ' ', u.apellidos) FROM usuario u WHERE u.id = p.id_usuario) AS nombre_autor,
                    ROUND(AVG(nota.nota_eval), 2) AS promedio,
                    COUNT(nota.nota_eval) AS n_evaluaciones,
                    (SELECT COUNT(*) FROM asignaciones_evaluadores ae
                        WHERE ae.id_poster = p.id AND ae.id_ronda = {$id_ronda}) AS n_asignados,
                    MAX(sel.id_seleccion IS NOT NULL) AS seleccionado,
                    MAX(sel.seleccion_manual) AS seleccion_manual,
                    MAX(sel.lugar) AS lugar,
                    MAX(sel.premio) AS premio,
                    MAX(sel.notificado) AS notificado
                FROM cargar_posters p
                LEFT JOIN (
                    SELECT d.id_poster, d.id_evaluador, ROUND(AVG(d.calificacion), 2) AS nota_eval
                    FROM evaluaciones_detalles d
                    WHERE d.id_ronda = {$id_ronda} AND d.calificacion > 0
                    GROUP BY d.id_poster, d.id_evaluador
                ) nota ON nota.id_poster = p.id
                LEFT JOIN selecciones sel ON sel.id_poster = p.id AND sel.id_ronda = {$id_ronda_sel}
                WHERE p.activo = 1 AND (p.id_evento = {$id_evento} OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = {$id_evento})) {$condicionSel}
                GROUP BY p.id
            ) base
            ORDER BY (base.n_evaluaciones > 0) DESC, base.promedio DESC, base.titulo ASC";

    // Los enteros ya pasaron por intval() y se validaron arriba; la consulta
    // además se prepara antes de ejecutarse.
    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        rh_log('Error al preparar ranking: ' . $conexion->error);
        rh_error(500, 'No fue posible calcular el ranking de la ronda.', 'error_servidor');
    }
    $stmt->execute();
    $resultado = $stmt->get_result();

    $filas = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id_poster'] = intval($fila['id_poster']);
        $fila['id_usuario'] = intval($fila['id_usuario']);
        $fila['n_evaluaciones'] = intval($fila['n_evaluaciones']);
        $fila['n_asignados'] = intval($fila['n_asignados']);
        $fila['seleccionado'] = intval($fila['seleccionado']) === 1;
        $fila['seleccion_manual'] = intval($fila['seleccion_manual']) === 1;
        $fila['notificado'] = intval($fila['notificado']) === 1;
        $esCorteHaciaSiguiente = ($id_ronda_sel !== $id_ronda);
        $fila['lugar'] = ($esCorteHaciaSiguiente || $fila['lugar'] === null) ? null : intval($fila['lugar']);
        $fila['premio'] = $esCorteHaciaSiguiente ? null : $fila['premio'];
        $fila['promedio'] = $fila['promedio'] === null ? null : round(floatval($fila['promedio']), 2);
        // Estado de la evaluación del póster en la ronda
        if ($fila['n_evaluaciones'] === 0) {
            $fila['estado_evaluacion'] = 'Sin evaluar';
        } elseif ($fila['n_asignados'] > $fila['n_evaluaciones']) {
            $fila['estado_evaluacion'] = 'Parcial ' . $fila['n_evaluaciones'] . ' de ' . $fila['n_asignados'];
        } else {
            $fila['estado_evaluacion'] = 'Completo';
        }
        $fila['pendientes'] = max(0, $fila['n_asignados'] - $fila['n_evaluaciones']);
        $filas[] = $fila;
    }
    $stmt->close();

    return $filas;
}

/**
 * Detección de empates en el corte (top N) o en el podio (top P).
 * Devuelve la lista sugerida (incluidos los empatados que quedan fuera, para
 * que el admin decida) y el motivo del empate.
 */
function rh_previsualizar_top($filas, $cupos, $requerirEvaluacion = true)
{
    $cupos = intval($cupos);
    $candidatos = [];
    foreach ($filas as $fila) {
        if ($requerirEvaluacion && intval($fila['n_evaluaciones']) === 0) continue;
        if ($fila['promedio'] === null) continue;
        $candidatos[] = $fila;
    }
    // Las filas ya vienen ordenadas por promedio descendente.
    $total = count($candidatos);
    $sugeridos = array_slice($candidatos, 0, max(0, $cupos));

    $empate = false;
    $motivoEmpate = '';
    $promedioCorte = $total > 0 && $cupos > 0 && $total >= $cupos
        ? $candidatos[$cupos - 1]['promedio']
        : null;

    $resultado = [];
    foreach ($candidatos as $indice => $fila) {
        $enTop = $indice < $cupos;
        $empatado = false;
        if ($promedioCorte !== null && floatval($fila['promedio']) === floatval($promedioCorte)) {
            $iguales = 0;
            foreach ($candidatos as $c) {
                if (floatval($c['promedio']) === floatval($promedioCorte)) $iguales++;
            }
            if ($iguales > 1) {
                $empatado = true;
                $empate = true;
            }
        }
        $fila['en_corte'] = $enTop;
        $fila['empate'] = $empatado;
        // Los empatados que quedan fuera del cupo también se muestran, para
        // que el admin decida a mano quién entra.
        if ($enTop || $empatado) $resultado[] = $fila;
    }

    if ($empate) {
        $motivoEmpate = 'Hay empate en la posición de corte por el promedio: decide tú quién entra.';
    }

    return [
        'cupos' => $cupos,
        'total_con_nota' => $total,
        'sugeridos' => array_map(function ($f) { return $f['id_poster']; }, $sugeridos),
        'empate' => $empate,
        'motivo_empate' => $motivoEmpate,
        'lista' => $resultado,
    ];
}

// ---------------------------------------------------------------------------
// Criterios por ronda
// ---------------------------------------------------------------------------

/**
 * Copia los criterios activos de una ronda a otra como punto de partida.
 * Solo se copia si la ronda destino todavía no tiene criterios: el admin puede
 * editarlos o borrarlos después desde GestionCriterios.
 */
function rh_copiar_criterios($conexion, $id_ronda_origen, $id_ronda_destino)
{
    $id_ronda_origen = intval($id_ronda_origen);
    $id_ronda_destino = intval($id_ronda_destino);
    if ($id_ronda_origen <= 0 || $id_ronda_destino <= 0 || $id_ronda_origen === $id_ronda_destino) return 0;

    $stmt = $conexion->prepare("SELECT COUNT(*) FROM criterios_evaluacion WHERE id_ronda = ? AND activo = 1");
    $stmt->bind_param("i", $id_ronda_destino);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_row();
    $stmt->close();
    if (intval($fila[0]) > 0) return 0;

    $sql = "INSERT INTO criterios_evaluacion (id_ronda, nombre, descripcion, activo, fecha_creacion)
            SELECT ?, nombre, descripcion, activo, NOW() FROM criterios_evaluacion
            WHERE id_ronda = ? AND activo = 1";
    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        rh_log('copiar_criterios: no se pudo preparar la consulta');
        return false;
    }
    $stmt->bind_param("ii", $id_ronda_destino, $id_ronda_origen);
    if (!$stmt->execute()) {
        // false = fallo real (la ronda destino quedaría sin criterios y nadie
        // podría calificar); 0 = simplemente no había criterios que copiar.
        rh_log('copiar_criterios: ' . $conexion->error);
        $stmt->close();
        return false;
    }
    $copiados = intval($stmt->affected_rows);
    $stmt->close();
    return $copiados;
}

/**
 * Criterios activos de una ronda (para avisar si la ronda queda sin ellos).
 */
function rh_tiene_criterios($conexion, $id_ronda)
{
    $stmt = $conexion->prepare("SELECT COUNT(*) FROM criterios_evaluacion WHERE id_ronda = ? AND activo = 1");
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_row();
    $stmt->close();
    return intval($fila[0]) > 0;
}

/**
 * Pósters que aún tienen evaluaciones PENDIENTES en una ronda (mejora 2026-10):
 * no se puede cerrar la ronda sin avisar de ellos.
 *
 * Regla por póster: debe tener al menos 1 nota; y si tiene N evaluadores
 * asignados, las N deben haber calificado. Si no tiene NINGÚN evaluador
 * asignado también cuenta como pendiente (nadie lo podría calificar).
 *
 * En la ronda 2+ solo se miran los pósters seleccionados para esa ronda.
 * Devuelve [{id_poster, titulo, faltan, evaluado_de, sin_evaluadores}].
 */
function rh_pendientes_de_ronda($conexion, $ronda)
{
    $id_ronda = intval($ronda['id_ronda']);
    $id_evento = intval($ronda['id_evento']);
    $esRondaPosterior = intval($ronda['numero']) > 1;

    $sql = "SELECT p.id AS id_poster, p.titulo,
                   COUNT(ae.id_asignacion) AS n_asig,
                   (SELECT COUNT(DISTINCT d.id_evaluador)
                      FROM evaluaciones_detalles d
                     WHERE d.id_poster = p.id AND d.id_ronda = ? AND d.calificacion > 0) AS n_eval
              FROM cargar_posters p
              LEFT JOIN asignaciones_evaluadores ae
                     ON ae.id_poster = p.id AND ae.id_ronda = ?
             WHERE p.activo = 1 AND (p.id_evento = ? OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = ?))"
        . ($esRondaPosterior
            ? " AND EXISTS (SELECT 1 FROM selecciones s WHERE s.id_poster = p.id AND s.id_ronda = ?)"
            : "")
        . " GROUP BY p.id, p.titulo
             HAVING n_eval < GREATEST(n_asig, 1)
             ORDER BY p.titulo ASC";

    if ($esRondaPosterior) {
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("iiiii", $id_ronda, $id_ronda, $id_evento, $id_evento, $id_ronda);
    } else {
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("iiii", $id_ronda, $id_ronda, $id_evento, $id_evento);
    }
    if (!$stmt) {
        rh_log('pendientes_de_ronda: ' . $conexion->error);
        return [];
    }
    $stmt->execute();
    $res = $stmt->get_result();

    $pendientes = [];
    while ($fila = $res->fetch_assoc()) {
        $nAsig = intval($fila['n_asig']);
        $nEval = intval($fila['n_eval']);
        $esperados = max(1, $nAsig);
        $pendientes[] = [
            'id_poster' => intval($fila['id_poster']),
            'titulo' => $fila['titulo'],
            'faltan' => max(1, $esperados - $nEval),
            'evaluado_de' => $nEval . ' de ' . $esperados,
            'sin_evaluadores' => $nAsig === 0,
        ];
    }
    $stmt->close();
    return $pendientes;
}

// ---------------------------------------------------------------------------
// Reasignación aleatoria para la ronda siguiente (Fase 1.3)
// ---------------------------------------------------------------------------

/**
 * Sortea N evaluadores por póster para la ronda siguiente.
 * Candidatos: rol evaluador (id_rol=2, activo), que NO calificó ese póster
 * en ninguna ronda previa y que no es su autor.
 *
 * REGLA (mejora 2026-10): la Ronda 1 tiene UN SOLO evaluador por póster; desde
 * la Ronda 2 en adelante pueden ser varios (por defecto 3, o el indicado en
 * $nEvaluadores, entre 1 y 5). Ya corre dentro de la transacción del corte.
 *
 * Devuelve ['asignados' => total, 'avisados' => correos,
 *           'sin_evaluadores' => [...], 'por_poster' => N].
 */
function rh_reasignar_aleatorio_ronda($conexion, $id_ronda_anterior, $id_ronda_siguiente, $ids_posters, $nEvaluadores = null)
{
    $id_ronda_anterior = intval($id_ronda_anterior);
    $id_ronda_siguiente = intval($id_ronda_siguiente);
    $ids_posters = array_values(array_unique(array_map('intval', (array)$ids_posters)));
    $ids_posters = array_values(array_filter($ids_posters, function ($v) { return $v > 0; }));
    if (count($ids_posters) === 0) return ['asignados' => 0, 'avisados' => [], 'sin_evaluadores' => [], 'por_poster' => 0];

    // Número y carrera del evento de la ronda destino (para aplicar la regla 1-vs-varios y priorizar evaluadores del evento).
    $numeroDestino = 0;
    $idEventoDestino = 0;
    $carreraEvDestino = 'sistemas';
    $stmt = $conexion->prepare("SELECT r.numero, r.id_evento, COALESCE(ev.carrera, 'sistemas') AS carrera FROM rondas r JOIN eventos ev ON ev.id_evento = r.id_evento WHERE r.id_ronda = ?");
    $stmt->bind_param("i", $id_ronda_siguiente);
    $stmt->execute();
    $filaNum = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($filaNum) {
        $numeroDestino = intval($filaNum['numero']);
        $idEventoDestino = intval($filaNum['id_evento']);
        $carreraEvDestino = mb_strtolower(trim((string)$filaNum['carrera']), 'UTF-8');
    }
    $patronCarreraDestino = strpos($carreraEvDestino, 'civil') !== false ? '%civil%' : '%sistema%';

    if ($nEvaluadores !== null && $nEvaluadores !== '') {
        $nPorPoster = max(1, min(5, intval($nEvaluadores)));
    } else {
        $nPorPoster = 3; // por defecto, varios evaluadores a partir de la ronda 2
    }
    if ($numeroDestino > 0 && $numeroDestino <= 1) {
        $nPorPoster = 1; // regla dura: Ronda 1 = un solo evaluador por póster
    }

    $total = 0;
    $avisados = [];
    $sinEvaluadores = [];

    // Limpieza: en la ronda destino solo deben quedar asignaciones de los
    // pósters que siguen seleccionados (si se corrigió el corte, los que salen
    // no deben conservar evaluadores asignados).
    if (count($ids_posters) > 0) {
        $excluir = implode(',', $ids_posters);
        $stmt = $conexion->prepare("DELETE FROM asignaciones_evaluadores WHERE id_ronda = ? AND id_poster NOT IN ({$excluir})");
        $stmt->bind_param("i", $id_ronda_siguiente);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new Exception('No se pudieron limpiar las asignaciones de la ronda destino');
        }
        $stmt->close();
    }

    foreach ($ids_posters as $id_poster) {
        // Autor del póster (se excluye siempre).
        $stmt = $conexion->prepare("SELECT id_usuario FROM cargar_posters WHERE id = ?");
        $stmt->bind_param("i", $id_poster);
        $stmt->execute();
        $filaAutor = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $id_autor = $filaAutor ? intval($filaAutor['id_usuario']) : 0;

        // Evaluadores que YA están asignados en la ronda destino: si ya alcanzan
        // N se conservan (re-ejecutar el corte no debe sumar evaluadores).
        $stmt = $conexion->prepare("SELECT COUNT(*) FROM asignaciones_evaluadores WHERE id_poster = ? AND id_ronda = ?");
        $stmt->bind_param("ii", $id_poster, $id_ronda_siguiente);
        $stmt->execute();
        $filaAsig = $stmt->get_result()->fetch_row();
        $stmt->close();
        $faltan = max(0, $nPorPoster - intval($filaAsig[0]));
        if ($faltan === 0) continue;

        // Candidatos: evaluadores activos que no son el autor, no están ya asignados en esta ronda
        // y no calificaron el póster en una ronda anterior de este mismo evento.
        // Se priorizan los evaluadores de la misma carrera/evento y menor carga en la ronda.
        $sql = "SELECT u.id, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre,
                       (SELECT COUNT(*) FROM asignaciones_evaluadores ae2
                         WHERE ae2.id_evaluador = u.id AND ae2.id_ronda = ?) AS carga_ronda
                FROM usuario u
                WHERE u.id_rol = 2 AND u.activo = 1 AND u.desactivado = 0 AND u.id <> ?
                  AND NOT EXISTS (
                      SELECT 1 FROM asignaciones_evaluadores ae_ya
                      WHERE ae_ya.id_poster = ? AND ae_ya.id_ronda = ? AND ae_ya.id_evaluador = u.id
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM evaluaciones e
                      JOIN rondas r_ev ON r_ev.id_ronda = e.id_ronda
                      WHERE e.id_poster = ? AND e.id_evaluador = u.id AND r_ev.id_evento = ?
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM poster_profesores pp
                      WHERE pp.id_poster = ? AND pp.id_usuario = u.id
                  )
                ORDER BY
                  CASE WHEN u.id_evento = ? OR LOWER(COALESCE(u.carrera, '')) LIKE ? THEN 0 ELSE 1 END ASC,
                  carga_ronda ASC,
                  RAND()
                LIMIT ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param(
            "iiiiiiiiisi",
            $id_ronda_siguiente,
            $id_autor,
            $id_poster,
            $id_ronda_siguiente,
            $id_poster,
            $idEventoDestino,
            $id_poster,
            $idEventoDestino,
            $patronCarreraDestino,
            $faltan
        );
        $stmt->execute();
        $res = $stmt->get_result();
        $candidatos = [];
        while ($fila = $res->fetch_assoc()) {
            $candidatos[] = $fila;
        }
        $stmt->close();

        // Sin candidatos posibles: el póster quedaría sin nadie que lo
        // califique (la elegibilidad exige asignación). Se reporta al admin.
        if (count($candidatos) === 0) {
            $sinEvaluadores[] = ['id_poster' => $id_poster, 'motivo' => 'sin_evaluadores_disponibles'];
            rh_log('reasignar_aleatorio: el póster ' . $id_poster . ' no tiene evaluadores disponibles para la ronda ' . $id_ronda_siguiente);
            continue;
        }

        foreach ($candidatos as $cand) {
            $id_ev = intval($cand['id']);
            $stmt = $conexion->prepare("INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador, id_ronda) VALUES (?, ?, ?)
                                        ON DUPLICATE KEY UPDATE id_evaluador = VALUES(id_evaluador)");
            $stmt->bind_param("iii", $id_poster, $id_ev, $id_ronda_siguiente);
            $ok = $stmt->execute();
            // 1 = fila nueva (solo a esa se avisa); 2 = ya existía.
            $filas = $ok ? $stmt->affected_rows : 0;
            $stmt->close();
            if (!$ok) {
                throw new Exception('No se pudo asignar el evaluador ' . $id_ev . ' al póster ' . $id_poster);
            }
            if ($filas === 1) {
                $total++;
                if (!empty($cand['correo'])) {
                    $avisados[] = [
                        'correo' => $cand['correo'],
                        'nombre' => $cand['nombre'],
                        'id_poster' => $id_poster,
                    ];
                }
            }
        }
    }

    return ['asignados' => $total, 'avisados' => $avisados, 'sin_evaluadores' => $sinEvaluadores, 'por_poster' => $nPorPoster];
}

// ---------------------------------------------------------------------------
// Correos (HTML institucional, contenido de usuario escapado)
// ---------------------------------------------------------------------------

function rh_titulo_premio($lugar)
{
    $lugar = intval($lugar);
    $nombres = [1 => '1er lugar', 2 => '2do lugar', 3 => '3er lugar'];
    $texto = isset($nombres[$lugar]) ? $nombres[$lugar] : ($lugar . 'º lugar');
    $emojis = [1 => '🥇', 2 => '🥈', 3 => '🥉'];
    $icono = isset($emojis[$lugar]) ? $emojis[$lugar] : '🏆';
    return $icono . ' ' . $texto;
}

function rh_plantilla_correo($titulo, $cuerpoHtml)
{
    $titulo = rh_escapar($titulo);
    return "
    <div style='font-family: Arial, Helvetica, sans-serif; background:#f5f7f8; padding:24px;'>
      <div style='max-width:620px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border-top:4px solid #00acc9;'>
        <div style='background:#132740; padding:18px 24px;'>
          <span style='color:#cad400; font-size:12px; letter-spacing:2px; text-transform:uppercase;'>Universidad Cooperativa de Colombia</span>
          <h2 style='color:#ffffff; margin:6px 0 0; font-size:20px;'>{$titulo}</h2>
        </div>
        <div style='padding:24px; color:#5f5e5e; font-size:15px; line-height:1.6;'>
          {$cuerpoHtml}
        </div>
        <div style='background:#f5f7f8; padding:16px 24px; color:#5f5e5e; font-size:12px;'>
          Sistema de Gestión de Pósteres — GensTI. Este es un mensaje automático, por favor no respondas a este correo.
        </div>
      </div>
    </div>";
}

/**
 * Devuelve la ubicación física de un póster con su nombre de espacio y su
 * número ordinal dentro del espacio (o 'sin ubicar todavía' si id_espacio IS NULL).
 */
function rh_ubicacion_poster($conexion, $id_poster)
{
    $id_poster = intval($id_poster);
    $res = [
        'id_espacio' => null,
        'nombre_espacio' => null,
        'numero' => null,
        'etiqueta' => 'sin ubicar todavía',
    ];
    if ($id_poster <= 0) return $res;

    $sql = "SELECT p.id_espacio,
                   e.nombre_espacio,
                   CASE
                       WHEN p.id_espacio IS NOT NULL THEN (
                           COALESCE((
                               SELECT SUM(e_prev.capacidad)
                               FROM espacios_fisicos e_prev
                               WHERE e_prev.id_evento = e.id_evento
                                 AND e_prev.id_espacio < e.id_espacio
                           ), 0) + (
                               SELECT COUNT(*) FROM cargar_posters p2
                               WHERE p2.id_espacio = p.id_espacio AND p2.id <= p.id AND p2.activo = 1
                           )
                       )
                       ELSE NULL
                   END AS numero_espacio
            FROM cargar_posters p
            LEFT JOIN espacios_fisicos e ON p.id_espacio = e.id_espacio
            WHERE p.id = ?
            LIMIT 1";
    $stmt = $conexion->prepare($sql);
    if (!$stmt) return $res;
    $stmt->bind_param("i", $id_poster);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($fila && !empty($fila['id_espacio']) && !empty($fila['nombre_espacio'])) {
        $num = max(1, intval($fila['numero_espacio'] ?: 1));
        $res['id_espacio'] = intval($fila['id_espacio']);
        $res['nombre_espacio'] = $fila['nombre_espacio'];
        $res['numero'] = $num;
        $res['etiqueta'] = $fila['nombre_espacio'] . ' #' . $num;
    }

    return $res;
}

/**
 * Garantiza de forma idempotente que exista la tabla `cambios_espacio_log`
 * para registrar cambios de espacio físico e informar en la campana in-app.
 */
function rh_asegurar_tabla_cambios_espacio($conexion)
{
    static $asegurada = false;
    if ($asegurada) return;
    $sql = "CREATE TABLE IF NOT EXISTS cambios_espacio_log (
                id_cambio INT AUTO_INCREMENT PRIMARY KEY,
                id_poster INT NOT NULL,
                id_espacio_anterior INT NULL DEFAULT NULL,
                nombre_espacio_anterior VARCHAR(150) NULL DEFAULT NULL,
                numero_anterior INT NULL DEFAULT NULL,
                id_espacio_nuevo INT NULL DEFAULT NULL,
                nombre_espacio_nuevo VARCHAR(150) NULL DEFAULT NULL,
                numero_nuevo INT NULL DEFAULT NULL,
                es_cambio TINYINT(1) NOT NULL DEFAULT 1,
                fecha_cambio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cambio_poster (id_poster, fecha_cambio)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    @$conexion->query($sql);
    $asegurada = true;
}
?>
