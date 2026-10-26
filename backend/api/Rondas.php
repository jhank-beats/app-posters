<?php
// backend/api/Rondas.php — Rondas de evaluación y premios.
//
// GET  (requiere sesión): listado de rondas, detalle con ranking y participantes.
// POST (requiere rol admin / super admin): configuración, corte, podio y premios.
//
// Seguridad (SEGURIDAD-CAMBIOS.txt + §8 del documento de especificación):
//   * La identidad SIEMPRE se toma del token vía require_role()/require_login().
//     Nunca se acepta rol_usuario / id_usuario / admin_id del cliente.
//   * Prepared statements en toda consulta; los enteros concatenados pasan por
//     intval() y se validan en rango.
//   * Los errores técnicos van al log del servidor; al cliente, mensaje en
//     español y genérico.
//   * Rate limit en las escrituras caras (corte y podio) para que nadie pueda
//     automatizar el envío masivo de correos ni manipular el ranking.

include_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/RondasHelper.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        manejarGet();
        break;
    case 'POST':
        manejarPost();
        break;
    default:
        rh_error(405, 'Método no permitido.', 'metodo_no_permitido');
}

// ===========================================================================
// LECTURA
// ===========================================================================

function manejarGet()
{
    global $conexion;
    $auth = require_login(); // cualquier usuario con sesión puede consultar

    if (isset($_GET['action']) && $_GET['action'] === 'participantes') {
        getParticipantes();
        return;
    }

    if (isset($_GET['action']) && $_GET['action'] === 'resumen') {
        getResumenEventos($auth);
        return;
    }

    if (isset($_GET['action']) && $_GET['action'] === 'resumen_ronda') {
        getResumenRonda($auth);
        return;
    }

    if (isset($_GET['action']) && $_GET['action'] === 'informe_ronda') {
        getInformeRonda($auth);
        return;
    }

    if (isset($_GET['id_ronda'])) {
        getDetalleRonda($auth);
        return;
    }

    if (isset($_GET['id_evento'])) {
        getRondasDeEvento($auth);
        return;
    }

    rh_error(400, 'Debes indicar id_evento, id_ronda o action=participantes.', 'parametros_invalidos');
}

// Ronda cuyas filas de `selecciones` describen esta vista:
// para la ronda 1 es la ronda siguiente (quién pasó el corte); para la ronda 2
// en adelante es la propia ronda (quién compite y qué lugar obtuvo).
function idSeleccionDeRonda($ronda)
{
    global $conexion;
    if (intval($ronda['numero']) > 1) return intval($ronda['id_ronda']);
    $siguiente = rh_ronda_siguiente($conexion, $ronda['id_ronda']);
    return $siguiente ? intval($siguiente['id_ronda']) : intval($ronda['id_ronda']);
}

function listarRondasDeEvento($id_evento)
{
    global $conexion;
    $id_evento = intval($id_evento);

    $sql = "SELECT r.id_ronda, r.id_evento, r.numero, r.nombre, r.estado,
                   COALESCE(r.corte_confirmado, 0) AS corte_confirmado, r.fecha_inicio,
                   r.fecha_cierre, r.cupos_seleccion, r.premios, r.fecha_registro,
                   ev.nombre_evento, ev.codigo_evento,
                   (SELECT COUNT(*) FROM evaluaciones e WHERE e.id_ronda = r.id_ronda) AS n_evaluaciones,
                   (SELECT COUNT(*) FROM criterios_evaluacion c WHERE c.id_ronda = r.id_ronda AND c.activo = 1) AS n_criterios,
                   (SELECT COUNT(*) FROM selecciones s WHERE s.id_ronda = r.id_ronda) AS n_selecciones,
                   (SELECT COUNT(*) FROM selecciones s WHERE s.id_ronda = r.id_ronda AND s.lugar IS NOT NULL) AS n_ganadores
            FROM rondas r
            JOIN eventos ev ON ev.id_evento = r.id_evento
            WHERE r.id_evento = ?
            ORDER BY r.numero ASC";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_evento);
    $stmt->execute();
    $resultado = $stmt->get_result();

    $rondas = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id_ronda'] = intval($fila['id_ronda']);
        $fila['numero'] = intval($fila['numero']);
        $fila['n_evaluaciones'] = intval($fila['n_evaluaciones']);
        $fila['n_criterios'] = intval($fila['n_criterios']);
        $fila['n_selecciones'] = intval($fila['n_selecciones']);
        $fila['n_ganadores'] = intval($fila['n_ganadores']);
        $fila['cupos_seleccion'] = $fila['cupos_seleccion'] === null ? null : intval($fila['cupos_seleccion']);
        $fila['premios'] = intval($fila['premios']);
        $fila['corte_confirmado'] = intval($fila['corte_confirmado'] ?? 0);
        $fila['ganadores'] = getGanadoresDeRonda(intval($fila['id_ronda']));
        $fila['criterios'] = getCriteriosDeRonda(intval($fila['id_ronda']));
        $rondas[] = $fila;
    }
    $stmt->close();
    return $rondas;
}

// Resumen por evento: rondas, estado, cupos, premios y ganadores (panel admin).
function getResumenEventos($auth)
{
    global $conexion;

    $id_evento_admin = auth_id_evento_admin($conexion, $auth);

    if ($id_evento_admin !== null) {
        $sql = "SELECT id_evento, nombre_evento, codigo_evento, COALESCE(carrera, 'sistemas') AS carrera, activo,
                       DATE_FORMAT(fecha_inicio, '%d/%m/%Y') AS fecha_inicio,
                       DATE_FORMAT(fecha_fin, '%d/%m/%Y') AS fecha_fin
                FROM eventos
                WHERE id_evento = ?
                ORDER BY activo DESC, id_evento DESC";
        $stmtEv = $conexion->prepare($sql);
        $stmtEv->bind_param("i", $id_evento_admin);
        $stmtEv->execute();
        $resultado = $stmtEv->get_result();
    } else {
        $sql = "SELECT id_evento, nombre_evento, codigo_evento, COALESCE(carrera, 'sistemas') AS carrera, activo,
                       DATE_FORMAT(fecha_inicio, '%d/%m/%Y') AS fecha_inicio,
                       DATE_FORMAT(fecha_fin, '%d/%m/%Y') AS fecha_fin
                FROM eventos
                ORDER BY activo DESC, id_evento DESC";
        $resultado = $conexion->query($sql);
    }

    $eventos = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id_evento'] = intval($fila['id_evento']);
        $fila['activo'] = intval($fila['activo']);
        $fila['rondas'] = listarRondasDeEvento(intval($fila['id_evento']));
        $fila['ganadores'] = [];
        foreach ($fila['rondas'] as $ronda) {
            foreach ($ronda['ganadores'] as $ganador) {
                $ganador['nombre_ronda'] = $ronda['nombre'];
                $ganador['nombre_evento'] = $fila['nombre_evento'];
                $fila['ganadores'][] = $ganador;
            }
        }
        $eventos[] = $fila;
    }
    if (isset($stmtEv) && $stmtEv) $stmtEv->close();

    rh_exito(['data' => $eventos, 'count' => count($eventos)]);
}

function getRondasDeEvento($auth)
{
    global $conexion;
    $id_evento = isset($_GET['id_evento']) ? intval($_GET['id_evento']) : 0;
    if ($id_evento <= 0) rh_error(400, 'El id_evento no es válido.', 'parametros_invalidos');

    $rondas = listarRondasDeEvento($id_evento);
    rh_exito(['data' => $rondas, 'count' => count($rondas)]);
}

function getGanadoresDeRonda($id_ronda)
{
    global $conexion;
    $sql = "SELECT s.id_poster, s.lugar, s.premio, s.seleccion_manual,
                   p.titulo, p.autores, p.id_usuario,
                   (SELECT CONCAT(u.nombres, ' ', u.apellidos) FROM usuario u WHERE u.id = p.id_usuario) AS nombre_autor
            FROM selecciones s
            JOIN cargar_posters p ON p.id = s.id_poster
            WHERE s.id_ronda = ? AND s.lugar IS NOT NULL
            ORDER BY s.lugar ASC";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resultado = $stmt->get_result();
    $ganadores = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id_poster'] = intval($fila['id_poster']);
        $fila['lugar'] = intval($fila['lugar']);
        $ganadores[] = $fila;
    }
    $stmt->close();
    return $ganadores;
}

function getCriteriosDeRonda($id_ronda)
{
    global $conexion;
    $sql = "SELECT id, nombre, descripcion FROM criterios_evaluacion
            WHERE id_ronda = ? AND activo = 1 ORDER BY id ASC";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resultado = $stmt->get_result();
    $criterios = [];
    while ($fila = $resultado->fetch_assoc()) {
        $fila['id'] = intval($fila['id']);
        $criterios[] = $fila;
    }
    $stmt->close();
    return $criterios;
}

function getDetalleRonda($auth)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $_GET['id_ronda']);
    $id_ronda_sel = idSeleccionDeRonda($ronda);
    $filas = rh_estadisticas_ronda($conexion, $ronda, $id_ronda_sel, intval($ronda['numero']) > 1);

    $cupos = $ronda['cupos_seleccion'] === null ? null : intval($ronda['cupos_seleccion']);
    $premios = intval($ronda['premios']);
    $empateCorte = ['empate' => false, 'motivo_empate' => ''];
    if ($cupos !== null && $cupos > 0) {
        $previa = rh_previsualizar_top($filas, $cupos);
        $empateCorte = ['empate' => $previa['empate'], 'motivo_empate' => $previa['motivo_empate']];
    }
    $empatePodio = ['empate' => false, 'motivo_empate' => ''];
    if ($premios > 0) {
        $previaPodio = rh_previsualizar_top($filas, $premios);
        $empatePodio = ['empate' => $previaPodio['empate'], 'motivo_empate' => $previaPodio['motivo_empate']];
    }

    // Notas propias del usuario en esta ronda (para la vista del evaluador).
    $misNotas = [];
    $sql = "SELECT id_poster, ROUND(AVG(calificacion), 2) AS nota
            FROM evaluaciones_detalles
            WHERE id_evaluador = ? AND id_ronda = ? AND calificacion > 0
            GROUP BY id_poster";
    $id_evaluador = intval($auth['id']);
    $id_ronda = intval($ronda['id_ronda']);
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("ii", $id_evaluador, $id_ronda);
    $stmt->execute();
    $resultado = $stmt->get_result();
    while ($fila = $resultado->fetch_assoc()) {
        $misNotas[intval($fila['id_poster'])] = round(floatval($fila['nota']), 2);
    }
    $stmt->close();

    rh_exito([
        'data' => [
            'ronda' => [
                'id_ronda' => intval($ronda['id_ronda']),
                'id_evento' => intval($ronda['id_evento']),
                'numero' => intval($ronda['numero']),
                'nombre' => $ronda['nombre'],
                'estado' => $ronda['estado'],
                'fecha_inicio' => $ronda['fecha_inicio'],
                'fecha_cierre' => $ronda['fecha_cierre'],
                'cupos_seleccion' => $ronda['cupos_seleccion'] === null ? null : intval($ronda['cupos_seleccion']),
                'premios' => intval($ronda['premios']),
                'corte_confirmado' => intval($ronda['corte_confirmado'] ?? 0),
                'nombre_evento' => $ronda['nombre_evento'],
                'codigo_evento' => $ronda['codigo_evento'],
                'id_ronda_seleccion' => $id_ronda_sel,
            ],
            'ranking' => $filas,
            'empate_corte' => $empateCorte,
            'empate_podio' => $empatePodio,
            'mis_notas' => $misNotas,
            'ganadores' => getGanadoresDeRonda($id_ronda_sel),
            'criterios' => getCriteriosDeRonda($id_ronda),
        ],
    ]);
}

function getParticipantes()
{
    global $conexion;
    // Devuelve correos y nombres de los evaluadores: solo administración.
    require_role([3, 4]);
    $ronda = rh_exigir_ronda($conexion, $_GET['id_ronda'] ?? 0);
    $participantes = rh_participantes_ronda($conexion, $ronda);

    rh_exito([
        'data' => $participantes,
        'count' => count($participantes),
        'ronda' => [
            'id_ronda' => intval($ronda['id_ronda']),
            'numero' => intval($ronda['numero']),
            'nombre' => $ronda['nombre'],
            'estado' => $ronda['estado'],
        ],
    ]);
}

// Resumen limpio de una ronda para el PDF (Fase 1.4): título, categoría,
// promedio, nº evaluaciones y si pasó a la siguiente ronda.
function getResumenRonda($auth)
{
    global $conexion;
    // El resumen expone promedios y notas completas: solo administración.
    require_role([3, 4]);
    $ronda = rh_exigir_ronda($conexion, $_GET['id_ronda'] ?? 0);
    if ($ronda['estado'] !== 'cerrada') {
        rh_error(409, 'El resumen de la ronda está disponible cuando la ronda está cerrada.', 'ronda_abierta');
    }
    $id_ronda_sel = idSeleccionDeRonda($ronda);
    // En la Ronda 2+ el resumen solo debe listar los pósters que COMPITEN en
    // ella (los seleccionados), no todos los del evento.
    $filas = rh_estadisticas_ronda($conexion, $ronda, $id_ronda_sel, intval($ronda['numero']) > 1);

    // "Pasa" = quedó seleccionado en la ronda SIGUIENTE. Para la ronda 1 es el
    // corte; para la 2+ significa que llegó a la 3, etc. En la última ronda no
    // hay siguiente (ahí se premia en el podio), así que no pasa nadie.
    $idsQuePasan = [];
    $siguiente = rh_ronda_siguiente($conexion, $ronda['id_ronda']);
    if ($siguiente) {
        $idSig = intval($siguiente['id_ronda']);
        $stmt = $conexion->prepare("SELECT id_poster FROM selecciones WHERE id_ronda = ?");
        $stmt->bind_param("i", $idSig);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($filaSel = $res->fetch_assoc()) {
            $idsQuePasan[intval($filaSel['id_poster'])] = true;
        }
        $stmt->close();
    }

    $resumen = [];
    foreach ($filas as $f) {
        $resumen[] = [
            'id_poster' => $f['id_poster'],
            'titulo' => $f['titulo'],
            'categoria' => $f['categoria'],
            'autores' => $f['autores'],
            'nombre_autor' => $f['nombre_autor'],
            'promedio' => $f['promedio'],
            'n_evaluaciones' => $f['n_evaluaciones'],
            'n_asignados' => $f['n_asignados'],
            'estado_evaluacion' => $f['estado_evaluacion'],
            'seleccionado' => $f['seleccionado'],
            'pasa' => isset($idsQuePasan[intval($f['id_poster'])]),
            'lugar' => $f['lugar'],
            'premio' => $f['premio'],
        ];
    }

    rh_exito([
        'data' => [
            'ronda' => [
                'id_ronda' => intval($ronda['id_ronda']),
                'numero' => intval($ronda['numero']),
                'nombre' => $ronda['nombre'],
                'estado' => $ronda['estado'],
                'corte_confirmado' => intval($ronda['corte_confirmado'] ?? 0),
                'fecha_cierre' => $ronda['fecha_cierre'],
                'nombre_evento' => $ronda['nombre_evento'],
                'codigo_evento' => $ronda['codigo_evento'],
            ],
            'posters' => $resumen,
            'count' => count($resumen),
        ],
    ]);
}

// Informe detallado de una ronda: por cada póster, la nota de CADA evaluador
// por separado (o "pendiente" si aún no calificó) y el promedio entre todos.
// Es el insumo del PDF "Informe de calificaciones" (mejora 2026-10).
function getInformeRonda($auth)
{
    global $conexion;
    // Notas completas por póster y evaluador: solo administración.
    require_role([3, 4]);
    $ronda = rh_exigir_ronda($conexion, $_GET['id_ronda'] ?? 0);
    $id_ronda = intval($ronda['id_ronda']);

    // Promedios y estado por póster (misma fuente que el ranking).
    // En la Ronda 2+ solo compiten los pósters SELECCIONADOS para esa ronda:
    // sin ese filtro salían también los que quedaron eliminados (informe con
    // pósters que ya no participan).
    $filas = rh_estadisticas_ronda($conexion, $ronda, idSeleccionDeRonda($ronda), intval($ronda['numero']) > 1);

    // Nota individual de cada evaluador: promedio de sus criterios en ESA ronda.
    // Es el mismo cálculo que alimenta el promedio del póster, así que la suma
    // de las notas individuales siempre cuadra con el promedio mostrado.
    $notas = []; // [id_poster][id_evaluador] => nota
    $stmt = $conexion->prepare("SELECT d.id_poster, d.id_evaluador, ROUND(AVG(d.calificacion), 2) AS nota
                                FROM evaluaciones_detalles d
                                WHERE d.id_ronda = ? AND d.calificacion > 0
                                GROUP BY d.id_poster, d.id_evaluador");
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resNotas = $stmt->get_result();
    while ($fila = $resNotas->fetch_assoc()) {
        $notas[intval($fila['id_poster'])][intval($fila['id_evaluador'])] = $fila['nota'] === null
            ? null : round(floatval($fila['nota']), 2);
    }
    $stmt->close();

    // Observaciones de cada evaluador (si las dejó).
    $obs = []; // [id_poster][id_evaluador] => observaciones
    $stmt = $conexion->prepare("SELECT id_poster, id_evaluador, observaciones
                                FROM evaluaciones
                                WHERE id_ronda = ? AND observaciones IS NOT NULL AND TRIM(observaciones) <> ''");
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resObs = $stmt->get_result();
    while ($fila = $resObs->fetch_assoc()) {
        $obs[intval($fila['id_poster'])][intval($fila['id_evaluador'])] = $fila['observaciones'];
    }
    $stmt->close();

    // Evaluadores asignados a esa ronda (incluye a los que todavía no califican).
    $asignados = []; // [id_poster] => [id_evaluador => nombre]
    $stmt = $conexion->prepare("SELECT ae.id_poster, ae.id_evaluador,
                                       CONCAT(u.nombres, ' ', u.apellidos) AS nombre_evaluador
                                FROM asignaciones_evaluadores ae
                                JOIN usuario u ON u.id = ae.id_evaluador
                                WHERE ae.id_ronda = ?
                                ORDER BY ae.id_poster, nombre_evaluador ASC");
    $stmt->bind_param("i", $id_ronda);
    $stmt->execute();
    $resAsig = $stmt->get_result();
    while ($fila = $resAsig->fetch_assoc()) {
        $asignados[intval($fila['id_poster'])][intval($fila['id_evaluador'])] = $fila['nombre_evaluador'];
    }
    $stmt->close();

    $informe = [];
    foreach ($filas as $f) {
        $idPoster = intval($f['id_poster']);
        $evaluadores = [];

        // Unión de "asignados" y "quienes ya calificaron" (por si un evaluador
        // se agregó a mano después de haber calificado).
        $nombres = isset($asignados[$idPoster]) ? $asignados[$idPoster] : [];
        if (isset($notas[$idPoster])) {
            foreach ($notas[$idPoster] as $idEv => $nota) {
                if (!isset($nombres[$idEv])) $nombres[$idEv] = 'Evaluador #' . $idEv;
            }
        }
        foreach ($nombres as $idEv => $nombre) {
            $califico = isset($notas[$idPoster][$idEv]);
            $evaluadores[] = [
                'id_evaluador' => intval($idEv),
                'nombre_evaluador' => $nombre,
                'nota' => $califico ? $notas[$idPoster][$idEv] : null,
                'califico' => $califico,
                'observaciones' => isset($obs[$idPoster][$idEv]) ? $obs[$idPoster][$idEv] : '',
            ];
        }

        $informe[] = [
            'id_poster' => $idPoster,
            'titulo' => $f['titulo'],
            'categoria' => $f['categoria'],
            'autores' => $f['autores'],
            'nombre_autor' => $f['nombre_autor'],
            'promedio' => $f['promedio'],
            'n_evaluaciones' => $f['n_evaluaciones'],
            'n_asignados' => $f['n_asignados'],
            'estado_evaluacion' => $f['estado_evaluacion'],
            'seleccionado' => $f['seleccionado'],
            'evaluadores' => $evaluadores,
        ];
    }

    rh_exito([
        'data' => [
            'ronda' => [
                'id_ronda' => $id_ronda,
                'numero' => intval($ronda['numero']),
                'nombre' => $ronda['nombre'],
                'estado' => $ronda['estado'],
                'corte_confirmado' => intval($ronda['corte_confirmado'] ?? 0),
                'fecha_inicio' => $ronda['fecha_inicio'],
                'fecha_cierre' => $ronda['fecha_cierre'],
                'nombre_evento' => $ronda['nombre_evento'],
                'codigo_evento' => $ronda['codigo_evento'],
            ],
            'posters' => $informe,
            'count' => count($informe),
        ],
    ]);
}

// ===========================================================================
// ESCRITURA
// ===========================================================================

function leerCuerpo()
{
    $crudo = file_get_contents('php://input');
    $datos = json_decode($crudo, true);
    return is_array($datos) ? $datos : [];
}

function manejarPost()
{
    global $conexion;
    $auth = require_role([3, 4]); // admin y super admin hacen lo mismo
    $datos = leerCuerpo();
    $accion = isset($datos['accion']) ? trim((string)$datos['accion']) : '';

    // Si es Admin (rol 3), solo puede operar sobre rondas de su evento asignado
    $id_evento_admin = auth_id_evento_admin($conexion, $auth);
    if ($id_evento_admin !== null) {
        if ($accion === 'crear_ronda') {
            $datos['id_evento'] = $id_evento_admin;
        } elseif (!empty($datos['id_ronda'])) {
            $rondaCheck = rh_ronda($conexion, intval($datos['id_ronda']));
            if ($rondaCheck && intval($rondaCheck['id_evento']) !== $id_evento_admin) {
                rh_error(403, 'Solo puedes gestionar las rondas de tu evento asignado.', 'evento_no_autorizado');
            }
        }
    }

    switch ($accion) {
        case 'crear_ronda':
            crearRonda($auth, $datos);
            break;
        case 'actualizar_ronda':
            actualizarRonda($auth, $datos);
            break;
        case 'abrir_ronda':
            abrirRonda($auth, $datos);
            break;
        case 'cerrar_ronda':
            cerrarRonda($auth, $datos);
            break;
        case 'cerrar_y_pasar':
            cerrarYPasar($auth, $datos);
            break;
        case 'previsualizar_corte':
            previsualizarCorte($auth, $datos);
            break;
        case 'confirmar_corte':
            // Deprecado (Fase 1): el corte único es cerrar_y_pasar. Se mantiene
            // el nombre solo para que un cliente viejo reciba un mensaje claro.
            rh_error(410, 'Esta acción fue reemplazada por "Cerrar ronda y pasar a la siguiente" (accion: cerrar_y_pasar).', 'accion_deprecada');
            break;
        case 'corregir_seleccion':
            corregirSeleccion($auth, $datos);
            break;
        case 'previsualizar_podio':
            previsualizarPodio($auth, $datos);
            break;
        case 'publicar_podio':
            publicarPodio($auth, $datos);
            break;
        case 'deshacer_podio':
            deshacerPodio($auth, $datos);
            break;
        default:
            rh_error(400, 'La acción solicitada no existe.', 'accion_invalida');
    }
}

// --- configuración de rondas ------------------------------------------------

function crearRonda($auth, $datos)
{
    global $conexion;

    $id_evento = intval($datos['id_evento'] ?? 0);
    if ($id_evento <= 0) rh_error(400, 'Debes indicar el evento de la ronda.', 'parametros_invalidos');

    $stmt = $conexion->prepare("SELECT id_evento FROM eventos WHERE id_evento = ?");
    $stmt->bind_param("i", $id_evento);
    $stmt->execute();
    if (!$stmt->get_result()->fetch_assoc()) {
        $stmt->close();
        rh_error(404, 'No se encontró el evento indicado.', 'evento_no_encontrado');
    }
    $stmt->close();

    $nombre = trim((string)($datos['nombre'] ?? ''));
    if ($nombre === '') rh_error(400, 'El nombre de la ronda es obligatorio.', 'parametros_invalidos');
    if (mb_strlen($nombre) > 120) $nombre = mb_substr($nombre, 0, 120);

    $premios = isset($datos['premios']) ? intval($datos['premios']) : 3;
    if ($premios < 1 || $premios > 20) rh_error(400, 'El número de premios debe estar entre 1 y 20.', 'parametros_invalidos');

    $cupos = null;
    if (isset($datos['cupos_seleccion']) && $datos['cupos_seleccion'] !== '' && $datos['cupos_seleccion'] !== null) {
        $cupos = intval($datos['cupos_seleccion']);
        if ($cupos < 0 || $cupos > 500) rh_error(400, 'Los cupos deben estar entre 0 y 500.', 'parametros_invalidos');
    }

    // Número automático: el siguiente libre dentro del evento.
    $sql = "SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM rondas WHERE id_evento = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_evento);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $numero = intval($fila['siguiente']);
    if ($numero > 127) rh_error(400, 'El evento ya tiene demasiadas rondas.', 'parametros_invalidos');

    $id_creador = intval($auth['id']);
    $sql = "INSERT INTO rondas (id_evento, numero, nombre, estado, fecha_inicio, cupos_seleccion, premios, creado_por)
            VALUES (?, ?, ?, 'abierta', NOW(), ?, ?, ?)";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("iisiii", $id_evento, $numero, $nombre, $cupos, $premios, $id_creador);
    if (!$stmt->execute()) {
        $stmt->close();
        rh_log('crear_ronda: ' . $conexion->error);
        rh_error(500, 'No fue posible crear la ronda.', 'error_servidor');
    }
    $id_ronda = intval($conexion->insert_id);
    $stmt->close();

    // Los criterios de la ronda anterior sirven como punto de partida.
    $criteriosCopiados = 0;
    if ($numero > 1) {
        $anterior = rh_ronda_por_numero($conexion, $id_evento, $numero - 1);
        if ($anterior) {
            $criteriosCopiados = intval(rh_copiar_criterios($conexion, intval($anterior['id_ronda']), $id_ronda));
        }
    }

    rh_exito([
        'data' => [
            'id_ronda' => $id_ronda,
            'id_evento' => $id_evento,
            'numero' => $numero,
            'nombre' => $nombre,
            'estado' => 'abierta',
            'cupos_seleccion' => $cupos,
            'premios' => $premios,
            'criterios_copiados' => $criteriosCopiados,
            'sin_criterios' => $criteriosCopiados === 0 && !rh_tiene_criterios($conexion, $id_ronda),
        ],
    ], 'Ronda creada correctamente');
}

function actualizarRonda($auth, $datos)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    if ($ronda['estado'] !== 'abierta') {
        rh_error(409, 'Solo se pueden editar las rondas abiertas.', 'ronda_cerrada');
    }

    $nombre = trim((string)($datos['nombre'] ?? $ronda['nombre']));
    if ($nombre === '') rh_error(400, 'El nombre de la ronda es obligatorio.', 'parametros_invalidos');
    if (mb_strlen($nombre) > 120) $nombre = mb_substr($nombre, 0, 120);

    $premios = isset($datos['premios']) ? intval($datos['premios']) : intval($ronda['premios']);
    if ($premios < 1 || $premios > 20) rh_error(400, 'El número de premios debe estar entre 1 y 20.', 'parametros_invalidos');

    $cupos = null;
    if (isset($datos['cupos_seleccion']) && $datos['cupos_seleccion'] !== '' && $datos['cupos_seleccion'] !== null) {
        $cupos = intval($datos['cupos_seleccion']);
        if ($cupos < 0 || $cupos > 500) rh_error(400, 'Los cupos deben estar entre 0 y 500.', 'parametros_invalidos');
    }

    $id_ronda = intval($ronda['id_ronda']);
    $sql = "UPDATE rondas SET nombre = ?, cupos_seleccion = ?, premios = ? WHERE id_ronda = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("siii", $nombre, $cupos, $premios, $id_ronda);
    if (!$stmt->execute()) {
        $stmt->close();
        rh_log('actualizar_ronda: ' . $conexion->error);
        rh_error(500, 'No fue posible actualizar la ronda.', 'error_servidor');
    }
    $stmt->close();

    rh_exito(['data' => ['id_ronda' => $id_ronda, 'nombre' => $nombre, 'cupos_seleccion' => $cupos, 'premios' => $premios]], 'Ronda actualizada');
}

function abrirRonda($auth, $datos)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    $id_ronda = intval($ronda['id_ronda']);
    $primeraApertura = $ronda['fecha_inicio'] === null;

    // Reabrir vuelve a dejar la ronda "en juego": el corte deja de estar
    // confirmado hasta que se vuelva a cerrar, para que no convivan las dos
    // acciones (cerrar_y_pasar y corregir_seleccion) sobre la misma ronda.
    $sql = "UPDATE rondas SET estado = 'abierta', fecha_inicio = COALESCE(fecha_inicio, NOW()), fecha_cierre = NULL, corte_confirmado = 0 WHERE id_ronda = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    if (!$stmt->execute()) {
        $stmt->close();
        rh_log('abrir_ronda: ' . $conexion->error);
        rh_error(500, 'No fue posible abrir la ronda.', 'error_servidor');
    }
    $stmt->close();

    // Aviso por correo a los evaluadores participantes (solo la primera vez,
    // para que abrir/cerrar repetidas veces no inunde buzones).
    $avisados = 0;
    if ($primeraApertura) {
        $participantes = rh_participantes_ronda($conexion, $ronda);
        foreach ($participantes as $participante) {
            if (empty($participante['correo'])) continue;
            $cuerpo = "
                <p>Hola, <strong>" . rh_escapar($participante['nombres'] . ' ' . $participante['apellidos']) . "</strong>,</p>
                <p>Se abrió la <strong>" . rh_escapar($ronda['nombre']) . "</strong> del evento <strong>" . rh_escapar($ronda['nombre_evento']) . "</strong>.</p>
                <p>Ya puedes ingresar a la plataforma, revisar los pósters y registrar tus calificaciones.</p>";
            encolarCorreoFondo($participante['correo'], 'Se abrió la ' . $ronda['nombre'] . ' de evaluación', rh_plantilla_correo('Ronda abierta', $cuerpo));
            $avisados++;
        }
    }

    rh_exito(['data' => ['id_ronda' => $id_ronda, 'estado' => 'abierta', 'evaluadores_avisados' => $avisados]], 'Ronda abierta');
}

function cerrarRonda($auth, $datos)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    $id_ronda = intval($ronda['id_ronda']);

    if ($ronda['estado'] !== 'abierta') {
        rh_error(409, 'La ronda ya está cerrada.', 'ronda_cerrada');
    }

    // Cierre simple SOLO para la última ronda ("cerrar sin pasar nada").
    // Para pasar pósters a la siguiente se usa cerrar_y_pasar.
    // Exige confirmación explícita del cliente.
    $final = !empty($datos['confirmar_cierre_final']);
    if (!$final) {
        rh_error(400, 'Para cerrar y pasar pósters a la siguiente ronda usa "Cerrar ronda y pasar a la siguiente". El cierre simple es solo para la última ronda (envía confirmar_cierre_final=true).', 'requiere_confirmacion');
    }

    // Guarda: si la ronda ya tiene (o puede tener) siguiente, el cierre debe
    // ser con selección. Si no, se cerraría sin definir quién pasa.
    if (rh_ronda_siguiente($conexion, $id_ronda)) {
        rh_error(409, 'Esta ronda ya tiene una siguiente: usa "Cerrar ronda y pasar a la siguiente".', 'no_es_final');
    }

    // Igual que en cerrar_y_pasar: no se cierra con pósters sin calificar,
    // salvo que el admin lo fuerce explícitamente.
    $pendientes = rh_pendientes_de_ronda($conexion, $ronda);
    if (count($pendientes) > 0 && empty($datos['forzar_cierre_pendientes'])) {
        rh_error(
            409,
            'No se puede cerrar la ronda: faltan ' . count($pendientes) . ' pósters por calificar.',
            'pendientes_sin_calificar',
            ['pendientes_total' => count($pendientes), 'pendientes' => $pendientes, 'titulos' => array_slice(array_column($pendientes, 'titulo'), 0, 10)]
        );
    }

    $sql = "UPDATE rondas SET estado = 'cerrada', fecha_cierre = NOW(), corte_confirmado = 0 WHERE id_ronda = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_ronda);
    if (!$stmt->execute()) {
        $stmt->close();
        rh_log('cerrar_ronda: ' . $conexion->error);
        rh_error(500, 'No fue posible cerrar la ronda.', 'error_servidor');
    }
    $stmt->close();

    rh_exito(['data' => ['id_ronda' => $id_ronda, 'estado' => 'cerrada', 'corte_confirmado' => 0]], 'Ronda cerrada sin corte (ronda final)');
}

// Acción única "Cerrar ronda y pasar a la siguiente" (Fase 1.2):
// valida selección no vacía, crea la N+1, escribe selecciones verificando
// affected_rows, reasigna evaluadores al azar, cierra con corte_confirmado=1
// y avisa a autores + nuevos evaluadores.
function cerrarYPasar($auth, $datos)
{
    global $conexion;

    if (!auth_rate_limit('cerrar_y_pasar_' . intval($auth['id']), 10, 300)) {
        rh_error(429, 'Demasiadas operaciones en poco tiempo. Intenta de nuevo en unos minutos.', 'limite_peticiones');
    }

    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    if ($ronda['estado'] !== 'abierta') {
        rh_error(409, 'Solo se puede cerrar una ronda abierta.', 'ronda_cerrada');
    }

    $seleccionados = normalizarIdsPosters($datos['ids_seleccionados'] ?? [], 'ids_seleccionados');
    if (count($seleccionados) === 0) {
        rh_error(400, 'Debes seleccionar al menos un póster para pasar a la siguiente ronda. Si es la última ronda, usa el cierre final.', 'seleccion_vacia');
    }
    $manuales = isset($datos['manuales']) ? normalizarIdsPosters($datos['manuales'], 'manuales') : [];

    // No se cierra con pósters sin calificar (mejora 2026-10): se devuelve la
    // lista con los títulos para que el admin decida. Solo se continúa si él
    // lo fuerza explícitamente.
    $pendientes = rh_pendientes_de_ronda($conexion, $ronda);
    if (count($pendientes) > 0 && empty($datos['forzar_cierre_pendientes'])) {
        $titulos = array_slice(array_column($pendientes, 'titulo'), 0, 10);
        rh_error(
            409,
            'No se puede cerrar la ronda: faltan ' . count($pendientes) . ' pósters por calificar.'
            . ' Si cierras de todos modos quedarán sin nota en esta ronda.',
            'pendientes_sin_calificar',
            ['pendientes_total' => count($pendientes), 'pendientes' => $pendientes, 'titulos' => $titulos]
        );
    }

    $cupos = isset($datos['cupos']) ? intval($datos['cupos']) : intval($ronda['cupos_seleccion'] ?? 0);
    if ($cupos < 0 || $cupos > 500) rh_error(400, 'Los cupos deben estar entre 0 y 500.', 'parametros_invalidos');

    $nombre_siguiente = trim((string)($datos['nombre_siguiente'] ?? ''));
    if ($nombre_siguiente === '') {
        $nombre_siguiente = 'Ronda ' . (intval($ronda['numero']) + 1) . ' · Exposición ante el auditorio';
    }
    if (mb_strlen($nombre_siguiente) > 120) $nombre_siguiente = mb_substr($nombre_siguiente, 0, 120);

    $premios_siguiente = isset($datos['premios_siguiente']) ? intval($datos['premios_siguiente']) : intval($ronda['premios']);
    if ($premios_siguiente < 1 || $premios_siguiente > 20) rh_error(400, 'El número de premios debe estar entre 1 y 20.', 'parametros_invalidos');

    $cupos_siguiente = null;
    if (isset($datos['cupos_siguiente']) && $datos['cupos_siguiente'] !== '' && $datos['cupos_siguiente'] !== null) {
        $cupos_siguiente = intval($datos['cupos_siguiente']);
        if ($cupos_siguiente < 0 || $cupos_siguiente > 500) rh_error(400, 'Los cupos deben estar entre 0 y 500.', 'parametros_invalidos');
    }

    $id_ronda = intval($ronda['id_ronda']);
    $id_evento = intval($ronda['id_evento']);
    $correos = [];
    $reasignados = 0;
    $evaluadoresAvisados = 0;

    try {
        $conexion->begin_transaction();

        $stmt = $conexion->prepare("SELECT id_ronda, estado, numero FROM rondas WHERE id_ronda = ? FOR UPDATE");
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        $bloqueada = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$bloqueada) {
            $conexion->rollback();
            rh_error(404, 'No se encontró la ronda indicada.', 'ronda_no_encontrada');
        }
        if ($bloqueada['estado'] !== 'abierta') {
            $conexion->rollback();
            rh_error(409, 'Solo se puede cerrar una ronda abierta.', 'ronda_cerrada');
        }

        $stmt = $conexion->prepare("SELECT id_ronda FROM rondas WHERE id_evento = ? AND numero = ? FOR UPDATE");
        $numero_siguiente = intval($bloqueada['numero']) + 1;
        $stmt->bind_param("ii", $id_evento, $numero_siguiente);
        $stmt->execute();
        $filaSig = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($filaSig) {
            $id_siguiente = intval($filaSig['id_ronda']);
            $stmt = $conexion->prepare("UPDATE rondas SET nombre = ?, cupos_seleccion = ?, premios = ?, estado = 'abierta', fecha_cierre = NULL WHERE id_ronda = ?");
            $stmt->bind_param("siii", $nombre_siguiente, $cupos_siguiente, $premios_siguiente, $id_siguiente);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new Exception('No se pudo actualizar la ronda siguiente');
            }
            $stmt->close();
        } else {
            $id_creador = intval($auth['id']);
            $stmt = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, fecha_inicio, cupos_seleccion, premios, creado_por)
                                        VALUES (?, ?, ?, 'abierta', NOW(), ?, ?, ?)");
            $stmt->bind_param("iisiii", $id_evento, $numero_siguiente, $nombre_siguiente, $cupos_siguiente, $premios_siguiente, $id_creador);
            if (!$stmt->execute()) {
                throw new Exception('No se pudo crear la ronda siguiente');
            }
            $id_siguiente = intval($conexion->insert_id);
            $stmt->close();
        }

        // Sin criterios la ronda siguiente sería incalificable: si la copia
        // falla, se aborta el corte entero (antes se ignoraba el error).
        $criteriosCopiados = rh_copiar_criterios($conexion, $id_ronda, $id_siguiente);
        if ($criteriosCopiados === false) {
            throw new Exception('No se pudieron copiar los criterios a la ronda siguiente');
        }
        // Aviso: si la ronda origen no tenía criterios activos, la siguiente
        // queda sin ellos y habrá que crearlos desde "Cambiar criterios".
        $sinCriteriosOrigen = !rh_tiene_criterios($conexion, $id_ronda);

        foreach ($seleccionados as $id_poster) {
            $stmt = $conexion->prepare("SELECT p.id FROM cargar_posters p WHERE p.id = ? AND p.activo = 1 AND (p.id_evento = ? OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = ?))");
            $stmt->bind_param("iii", $id_poster, $id_evento, $id_evento);
            $stmt->execute();
            if (!$stmt->get_result()->fetch_assoc()) {
                $stmt->close();
                throw new Exception('Póster no válido para este evento');
            }
            $stmt->close();
        }

        // Se reemplaza SOLO lo que ya no pasa: así `notificado` se conserva y
        // re-ejecutar el corte no vuelve a enviar el mismo correo (bug Fase 1).
        $excluir = implode(',', array_values($seleccionados));
        $stmt = $conexion->prepare("DELETE FROM selecciones WHERE id_ronda = ? AND id_poster NOT IN ({$excluir})");
        $stmt->bind_param("i", $id_siguiente);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new Exception('No se pudo limpiar la selección previa');
        }
        $stmt->close();

        foreach ($seleccionados as $id_poster) {
            $manual = isset($manuales[$id_poster]) ? 1 : 0;
            $stmt = $conexion->prepare("INSERT INTO selecciones (id_ronda, id_poster, seleccion_manual, notificado)
                                        VALUES (?, ?, ?, 0)
                                        ON DUPLICATE KEY UPDATE seleccion_manual = VALUES(seleccion_manual)");
            $stmt->bind_param("iii", $id_siguiente, $id_poster, $manual);
            // 1 = insert nuevo, 2 = actualizado, 0 = sin cambios (ya estaba).
            if (!$stmt->execute() || ($stmt->affected_rows !== 0 && $stmt->affected_rows !== 1 && $stmt->affected_rows !== 2)) {
                $stmt->close();
                throw new Exception('No se pudo guardar la selección del póster ' . $id_poster);
            }
            $stmt->close();
        }

        // Reasignación aleatoria de la ronda siguiente (Fase 1.3).
        // N evaluadores por póster: 1 en la Ronda 1 (regla dura); varios desde
        // la Ronda 2 (por defecto 3, o lo que haya pedido el admin).
        $nEvaluadores = isset($datos['evaluadores_siguiente']) ? intval($datos['evaluadores_siguiente']) : null;
        $reasig = rh_reasignar_aleatorio_ronda($conexion, $id_ronda, $id_siguiente, array_values($seleccionados), $nEvaluadores);
        $reasignados = intval($reasig['asignados']);
        $sinEvaluadores = $reasig['sin_evaluadores'] ?? [];
        $evaluadoresPorPoster = intval($reasig['por_poster'] ?? 0);

        $stmt = $conexion->prepare("SELECT s.id_poster, s.notificado, p.titulo, p.autores, u.correo,
                                           CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor
                                    FROM selecciones s
                                    JOIN cargar_posters p ON p.id = s.id_poster
                                    JOIN usuario u ON u.id = p.id_usuario
                                    WHERE s.id_ronda = ? AND s.notificado = 0");
        $stmt->bind_param("i", $id_siguiente);
        $stmt->execute();
        $resultado = $stmt->get_result();
        $nuevos = [];
        while ($fila = $resultado->fetch_assoc()) {
            $nuevos[] = $fila;
        }
        $stmt->close();

        $idsNuevos = array_map('intval', array_column($nuevos, 'id_poster'));
        if (count($idsNuevos) > 0) {
            $stmt = $conexion->prepare("UPDATE selecciones SET notificado = 1 WHERE id_ronda = ? AND id_poster IN (" . implode(',', $idsNuevos) . ")");
            $stmt->bind_param("i", $id_siguiente);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new Exception('No se pudo marcar la selección como notificada');
            }
            $stmt->close();
        }

        // El cierre de la ronda es el paso final: si falla, nada debe quedar
        // consolidado (antes se hacía commit aunque el UPDATE fallara).
        $stmt = $conexion->prepare("UPDATE rondas SET estado = 'cerrada', fecha_cierre = NOW(), cupos_seleccion = ?, corte_confirmado = 1 WHERE id_ronda = ?");
        $stmt->bind_param("ii", $cupos, $id_ronda);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new Exception('No se pudo cerrar la ronda actual');
        }
        $stmt->close();

        $conexion->commit();
        $evaluadoresNuevos = $reasig['avisados'];
    } catch (Throwable $e) {
        $conexion->rollback();
        rh_log('cerrar_y_pasar: ' . $e->getMessage());
        rh_error(500, 'No fue posible cerrar la ronda. No se guardó ningún cambio.', 'error_servidor');
    }

    foreach ($nuevos as $fila) {
        if (empty($fila['correo'])) continue;
        $titulo = rh_escapar($fila['titulo']);
        $cuerpo = "
            <p>¡Hola, <strong>" . rh_escapar($fila['nombre_autor']) . "</strong>!</p>
            <p>Tu póster <strong>'{$titulo}'</strong> pasó a la siguiente ronda del evento <strong>" . rh_escapar($ronda['nombre_evento']) . "</strong>.</p>
            <p>¡Felicidades! Revisa la plataforma para ver el detalle de la convocatoria.</p>";
        encolarCorreoFondo($fila['correo'], '¡Tu póster pasó a la siguiente ronda!', rh_plantilla_correo('¡Tu póster pasó a la siguiente ronda!', $cuerpo));
        $correos[] = $fila['correo'];
    }

    // Aviso a los nuevos evaluadores de la Ronda 2.
    $titulos = [];
    if (count($idsNuevos) > 0) {
        $marcas = implode(',', $idsNuevos);
        $res = $conexion->query("SELECT id, titulo FROM cargar_posters WHERE id IN ($marcas)");
        if ($res) {
            while ($f = $res->fetch_assoc()) {
                $titulos[intval($f['id'])] = $f['titulo'];
            }
        }
    }
    foreach (($evaluadoresNuevos ?? []) as $ev) {
        if (empty($ev['correo'])) continue;
        $t = rh_escapar($titulos[$ev['id_poster']] ?? 'póster asignado');
        $cuerpo = "
            <p>Hola, <strong>" . rh_escapar($ev['nombre']) . "</strong>,</p>
            <p>Se te asignó el póster <strong>'{$t}'</strong> en la <strong>Ronda " . (intval($ronda['numero']) + 1) . "</strong> del evento <strong>" . rh_escapar($ronda['nombre_evento']) . "</strong>.</p>
            <p>Ingresa a la plataforma para registrar tu calificación.</p>";
        encolarCorreoFondo($ev['correo'], 'Te asignaron pósters de la Ronda ' . (intval($ronda['numero']) + 1), rh_plantilla_correo('Nuevos pósters asignados', $cuerpo));
        $evaluadoresAvisados++;
    }

    rh_exito([
        'data' => [
            'id_ronda' => $id_ronda,
            'id_ronda_destino' => $id_siguiente,
            'numero_destino' => $numero_siguiente,
            'seleccionados' => count($seleccionados),
            'autores_avisados' => count($correos),
            'asignaciones_nuevas' => $reasignados,
            'evaluadores_avisados' => $evaluadoresAvisados,
            'evaluadores_por_poster' => $evaluadoresPorPoster,
            'sin_evaluadores' => $sinEvaluadores,
            'criterios_copiados' => intval($criteriosCopiados ?? 0),
            'sin_criterios' => !empty($sinCriteriosOrigen),
            'manuales' => count($manuales),
            'estado' => 'cerrada',
            'corte_confirmado' => 1,
        ],
    ], 'Ronda cerrada y pósters pasados a la siguiente ronda');
}

// --- corte (paso a la siguiente ronda) --------------------------------------

function previsualizarCorte($auth, $datos)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);

    $cupos = isset($datos['cupos']) ? intval($datos['cupos']) : intval($ronda['cupos_seleccion'] ?? 0);
    if ($cupos < 0 || $cupos > 500) rh_error(400, 'Los cupos deben estar entre 0 y 500.', 'parametros_invalidos');

    $filas = rh_estadisticas_ronda($conexion, $ronda, idSeleccionDeRonda($ronda), intval($ronda['numero']) > 1);
    $previa = rh_previsualizar_top($filas, $cupos);

    // Pósters sin calificar en esta ronda: se av ANTES de cerrar (mejora 2026-10).
    $pendientes = rh_pendientes_de_ronda($conexion, $ronda);

    rh_exito([
        'data' => [
            'ronda' => ['id_ronda' => intval($ronda['id_ronda']), 'numero' => intval($ronda['numero']), 'nombre' => $ronda['nombre']],
            'cupos' => $previa['cupos'],
            'total_con_nota' => $previa['total_con_nota'],
            'sugeridos' => $previa['sugeridos'],
            'empate' => $previa['empate'],
            'motivo_empate' => $previa['motivo_empate'],
            'lista' => $previa['lista'],
            'pendientes' => $pendientes,
            'pendientes_total' => count($pendientes),
        ],
    ], 'Previsualización del corte generada');
}

function normalizarIdsPosters($valor, $campo)
{
    if (!is_array($valor)) rh_error(400, "El campo {$campo} debe ser una lista de pósters.", 'parametros_invalidos');
    $ids = [];
    foreach ($valor as $id) {
        $id = intval($id);
        if ($id <= 0) rh_error(400, "El campo {$campo} contiene un identificador de póster no válido.", 'parametros_invalidos');
        $ids[$id] = $id;
    }
    return $ids;
}


function corregirSeleccion($auth, $datos)
{
    global $conexion;

    if (!auth_rate_limit('corregir_seleccion_' . intval($auth['id']), 10, 300)) {
        rh_error(429, 'Demasiadas operaciones en poco tiempo. Intenta de nuevo en unos minutos.', 'limite_peticiones');
    }

    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    if (intval($ronda['corte_confirmado'] ?? 0) !== 1) {
        rh_error(409, 'Solo se puede corregir una selección ya confirmada (usa "Cerrar ronda y pasar a la siguiente" primero).', 'sin_corte');
    }
    // La corrección es sobre un corte YA hecho (ronda cerrada). Si la ronda
    // está abierta, hay que cerrarla de nuevo con cerrar_y_pasar.
    if ($ronda['estado'] === 'abierta') {
        rh_error(409, 'La ronda está abierta: vuelve a cerrarla con "Cerrar ronda y pasar a la siguiente".', 'ronda_abierta');
    }
    $seleccionados = normalizarIdsPosters($datos['ids_seleccionados'] ?? [], 'ids_seleccionados');
    if (count($seleccionados) === 0) {
        rh_error(400, 'Debes seleccionar al menos un póster.', 'seleccion_vacia');
    }
    $manuales = isset($datos['manuales']) ? normalizarIdsPosters($datos['manuales'], 'manuales') : [];

    $id_ronda = intval($ronda['id_ronda']);
    $id_evento = intval($ronda['id_evento']);
    $correos = [];

    try {
        $conexion->begin_transaction();

        $stmt = $conexion->prepare("SELECT id_ronda FROM rondas WHERE id_evento = ? AND numero = ? FOR UPDATE");
        $numero_siguiente = intval($ronda['numero']) + 1;
        $stmt->bind_param("ii", $id_evento, $numero_siguiente);
        $stmt->execute();
        $filaSig = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$filaSig) {
            $conexion->rollback();
            rh_error(404, 'Esta ronda todavía no tiene una selección confirmada.', 'seleccion_no_encontrada');
        }
        $id_siguiente = intval($filaSig['id_ronda']);

        foreach ($seleccionados as $id_poster) {
            $stmt = $conexion->prepare("SELECT p.id FROM cargar_posters p WHERE p.id = ? AND p.activo = 1 AND (p.id_evento = ? OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = ?))");
            $stmt->bind_param("iii", $id_poster, $id_evento, $id_evento);
            $stmt->execute();
            if (!$stmt->get_result()->fetch_assoc()) {
                $stmt->close();
                throw new Exception('Póster no válido para este evento');
            }
            $stmt->close();
        }

        $stmt = $conexion->prepare("DELETE FROM selecciones WHERE id_ronda = ? AND id_poster NOT IN (" . (count($seleccionados) > 0 ? implode(',', array_values($seleccionados)) : '0') . ")");
        $stmt->bind_param("i", $id_siguiente);
        $stmt->execute();
        $stmt->close();

        foreach ($seleccionados as $id_poster) {
            $manual = isset($manuales[$id_poster]) ? 1 : 0;
            $stmt = $conexion->prepare("INSERT INTO selecciones (id_ronda, id_poster, seleccion_manual, notificado)
                                        VALUES (?, ?, ?, 0)
                                        ON DUPLICATE KEY UPDATE seleccion_manual = VALUES(seleccion_manual)");
            $stmt->bind_param("iii", $id_siguiente, $id_poster, $manual);
            if (!$stmt->execute() || ($stmt->affected_rows !== 1 && $stmt->affected_rows !== 2 && $stmt->affected_rows !== 0)) {
                $stmt->close();
                throw new Exception('No se pudo guardar la selección del póster ' . $id_poster);
            }
            $stmt->close();
        }

        // Reasignación aleatoria de la ronda siguiente (Fase 1.3, también al corregir).
        $nEvaluadoresCor = isset($datos['evaluadores_siguiente']) ? intval($datos['evaluadores_siguiente']) : null;
        $reasigCor = rh_reasignar_aleatorio_ronda($conexion, $id_ronda, $id_siguiente, array_values($seleccionados), $nEvaluadoresCor);

        // Solo se notifica a los que entran de nuevo.
        $stmt = $conexion->prepare("SELECT s.id_poster, p.titulo, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor
                                    FROM selecciones s
                                    JOIN cargar_posters p ON p.id = s.id_poster
                                    JOIN usuario u ON u.id = p.id_usuario
                                    WHERE s.id_ronda = ? AND s.notificado = 0");
        $stmt->bind_param("i", $id_siguiente);
        $stmt->execute();
        $resultado = $stmt->get_result();
        $nuevos = [];
        while ($fila = $resultado->fetch_assoc()) {
            $nuevos[] = $fila;
        }
        $stmt->close();

        $idsNuevos = array_map('intval', array_column($nuevos, 'id_poster'));
        if (count($idsNuevos) > 0) {
            $stmt = $conexion->prepare("UPDATE selecciones SET notificado = 1 WHERE id_ronda = ? AND id_poster IN (" . implode(',', $idsNuevos) . ")");
            $stmt->bind_param("i", $id_siguiente);
            $stmt->execute();
            $stmt->close();
        }

        $conexion->commit();
    } catch (Exception $e) {
        $conexion->rollback();
        rh_log('corregir_seleccion: ' . $e->getMessage());
        rh_error(500, 'No fue posible corregir la selección. No se guardó ningún cambio.', 'error_servidor');
    }

    foreach ($nuevos as $fila) {
        if (empty($fila['correo'])) continue;
        $titulo = rh_escapar($fila['titulo']);
        $cuerpo = "
            <p>¡Hola, <strong>" . rh_escapar($fila['nombre_autor']) . "</strong>!</p>
            <p>Tu póster <strong>'{$titulo}'</strong> pasó a la siguiente ronda del evento <strong>" . rh_escapar($ronda['nombre_evento']) . "</strong>.</p>";
        encolarCorreoFondo($fila['correo'], '¡Tu póster pasó a la siguiente ronda!', rh_plantilla_correo('¡Tu póster pasó a la siguiente ronda!', $cuerpo));
        $correos[] = $fila['correo'];
    }

    rh_exito([
        'data' => [
            'id_ronda' => $id_ronda,
            'id_ronda_destino' => $id_siguiente,
            'seleccionados' => count($seleccionados),
            'autores_avisados' => count($correos),
            'evaluadores_por_poster' => intval($reasigCor['por_poster'] ?? 0),
            'sin_evaluadores' => $reasigCor['sin_evaluadores'] ?? [],
        ],
    ], 'Selección actualizada');
}

// --- podio y premios --------------------------------------------------------

function previsualizarPodio($auth, $datos)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);

    $premios = isset($datos['premios']) ? intval($datos['premios']) : intval($ronda['premios']);
    if ($premios < 1 || $premios > 20) rh_error(400, 'El número de premios debe estar entre 1 y 20.', 'parametros_invalidos');

    $filas = rh_estadisticas_ronda($conexion, $ronda, idSeleccionDeRonda($ronda), intval($ronda['numero']) > 1);
    $previa = rh_previsualizar_top($filas, $premios);

    $lista = [];
    foreach ($previa['lista'] as $indice => $fila) {
        $fila['lugar_sugerido'] = $fila['en_corte'] ? ($indice + 1) : null;
        $fila['premio_sugerido'] = $fila['en_corte'] ? rh_titulo_premio($indice + 1) : null;
        $lista[] = $fila;
    }

    rh_exito([
        'data' => [
            'ronda' => ['id_ronda' => intval($ronda['id_ronda']), 'numero' => intval($ronda['numero']), 'nombre' => $ronda['nombre']],
            'premios' => $premios,
            'empate' => $previa['empate'],
            'motivo_empate' => $previa['motivo_empate'],
            'lista' => $lista,
        ],
    ], 'Previsualización del podio generada');
}

function publicarPodio($auth, $datos)
{
    global $conexion;

    if (!auth_rate_limit('publicar_podio_' . intval($auth['id']), 10, 300)) {
        rh_error(429, 'Demasiadas operaciones en poco tiempo. Intenta de nuevo en unos minutos.', 'limite_peticiones');
    }

    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    $premios = isset($datos['premios']) ? intval($datos['premios']) : intval($ronda['premios']);
    if ($premios < 1 || $premios > 20) rh_error(400, 'El número de premios debe estar entre 1 y 20.', 'parametros_invalidos');

    $lugares = $datos['lugares'] ?? [];
    if (!is_array($lugares) || count($lugares) === 0) {
        rh_error(400, 'Debes indicar el lugar de al menos un póster.', 'parametros_invalidos');
    }

    $id_ronda = intval($ronda['id_ronda']);
    $id_ronda_sel = idSeleccionDeRonda($ronda);
    $yaPublicado = $ronda['fecha_cierre'] !== null;
    $correosGanadores = 0;

    $premiados = [];
    $lugaresVistos = [];
    foreach ($lugares as $item) {
        if (!is_array($item)) rh_error(400, 'La lista de lugares no tiene un formato válido.', 'parametros_invalidos');
        $id_poster = intval($item['id_poster'] ?? 0);
        $lugar = intval($item['lugar'] ?? 0);
        if ($id_poster <= 0 || $lugar <= 0 || $lugar > $premios) {
            rh_error(400, 'Cada premio debe indicar un póster y un lugar entre 1 y ' . $premios . '.', 'parametros_invalidos');
        }
        if (isset($lugaresVistos[$lugar])) {
            rh_error(400, 'Dos pósters no pueden tener el mismo lugar en el podio.', 'parametros_invalidos');
        }
        $lugaresVistos[$lugar] = true;
        $premio = trim((string)($item['premio'] ?? ''));
        if ($premio === '') $premio = rh_titulo_premio($lugar);
        $premiados[] = ['id_poster' => $id_poster, 'lugar' => $lugar, 'premio' => $premio];
    }

    try {
        $conexion->begin_transaction();

        $stmt = $conexion->prepare("SELECT id_ronda FROM rondas WHERE id_ronda = ? FOR UPDATE");
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) {
            $stmt->close();
            $conexion->rollback();
            rh_error(404, 'No se encontró la ronda indicada.', 'ronda_no_encontrada');
        }
        $stmt->close();

        // Quitar los lugares previos y asignar los nuevos.
        $stmt = $conexion->prepare("UPDATE selecciones SET lugar = NULL, premio = NULL WHERE id_ronda = ?");
        $stmt->bind_param("i", $id_ronda_sel);
        $stmt->execute();
        $stmt->close();

        foreach ($premiados as $premiado) {
            $stmt = $conexion->prepare("UPDATE selecciones SET lugar = ?, premio = ? WHERE id_ronda = ? AND id_poster = ?");
            $stmt->bind_param("isii", $premiado['lugar'], $premiado['premio'], $id_ronda_sel, $premiado['id_poster']);
            $stmt->execute();
            if ($stmt->affected_rows < 0) throw new Exception('No se pudo asignar el lugar');
            $stmt->close();
        }

        $stmt = $conexion->prepare("UPDATE rondas SET estado = 'cerrada', fecha_cierre = NOW(), premios = ? WHERE id_ronda = ?");
        $stmt->bind_param("ii", $premios, $id_ronda);
        $stmt->execute();
        $stmt->close();

        $conexion->commit();
    } catch (Exception $e) {
        $conexion->rollback();
        rh_log('publicar_podio: ' . $e->getMessage());
        rh_error(500, 'No fue posible publicar el podio. No se guardó ningún cambio.', 'error_servidor');
    }

    // Correos: ganadores y evaluadores. Solo en la primera publicación, para
    // que corregir el podio no repita los avisos.
    if (!$yaPublicado) {
        foreach ($premiados as $premiado) {
            $stmt = $conexion->prepare("SELECT p.titulo, p.autores, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor
                                        FROM cargar_posters p JOIN usuario u ON u.id = p.id_usuario
                                        WHERE p.id = ?");
            $stmt->bind_param("i", $premiado['id_poster']);
            $stmt->execute();
            $fila = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$fila || empty($fila['correo'])) continue;

            $titulo = rh_escapar($fila['titulo']);
            $lugarTexto = rh_escapar($premiado['premio']);
            $cuerpo = "
                <p>¡Hola, <strong>" . rh_escapar($fila['nombre_autor']) . "</strong>!</p>
                <p>¡Felicidades! Tu póster <strong>'{$titulo}'</strong> obtuvo el <strong>{$lugarTexto}</strong> en el evento <strong>" . rh_escapar($ronda['nombre_evento']) . "</strong>.</p>
                <p>Tu certificado está disponible en la plataforma.</p>";
            encolarCorreoFondo($fila['correo'], '¡Felicidades, obtuviste el ' . $premiado['premio'] . '!', rh_plantilla_correo('¡Felicidades!', $cuerpo));
            $correosGanadores++;
        }

        // Evaluadores participantes: resultados de la ronda.
        $participantes = rh_participantes_ronda($conexion, $ronda);
        foreach ($participantes as $participante) {
            if (empty($participante['correo'])) continue;
            $cuerpo = "
                <p>Hola, <strong>" . rh_escapar($participante['nombres'] . ' ' . $participante['apellidos']) . "</strong>,</p>
                <p>Se publicaron los resultados de la <strong>" . rh_escapar($ronda['nombre']) . "</strong> del evento <strong>" . rh_escapar($ronda['nombre_evento']) . "</strong>.</p>
                <p>Gracias por tu participación como evaluador.</p>";
            encolarCorreoFondo($participante['correo'], 'Resultados de la ' . $ronda['nombre'], rh_plantilla_correo('Resultados de la ronda', $cuerpo));
        }
    }

    rh_exito([
        'data' => [
            'id_ronda' => $id_ronda,
            'id_ronda_seleccion' => $id_ronda_sel,
            'premios' => $premios,
            'ganadores' => $premiados,
            'correos_enviados' => $correosGanadores,
            'estado' => 'cerrada',
        ],
    ], 'Podio publicado');
}

function deshacerPodio($auth, $datos)
{
    global $conexion;
    $ronda = rh_exigir_ronda($conexion, $datos['id_ronda'] ?? 0);
    $id_ronda = intval($ronda['id_ronda']);
    $id_ronda_sel = idSeleccionDeRonda($ronda);

    try {
        $conexion->begin_transaction();

        $stmt = $conexion->prepare("UPDATE selecciones SET lugar = NULL, premio = NULL WHERE id_ronda = ?");
        $stmt->bind_param("i", $id_ronda_sel);
        $stmt->execute();
        $stmt->close();

        $stmt = $conexion->prepare("UPDATE rondas SET estado = 'abierta', fecha_cierre = NULL WHERE id_ronda = ?");
        $stmt->bind_param("i", $id_ronda);
        $stmt->execute();
        $stmt->close();

        $conexion->commit();
    } catch (Exception $e) {
        $conexion->rollback();
        rh_log('deshacer_podio: ' . $e->getMessage());
        rh_error(500, 'No fue posible deshacer el podio.', 'error_servidor');
    }

    rh_exito(['data' => ['id_ronda' => $id_ronda, 'estado' => 'abierta']], 'Podio deshecho; la ronda volvió a abrirse');
}
?>
