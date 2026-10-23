<?php
// backend/api/Notificaciones.php — novedades de rondas y premios para la campana.
//
// GET (requiere sesión): lista {id, icon, titulo, desc, ancla} filtrada por el
// usuario del token. Nunca se devuelven notas ni correos de terceros.
//
// Cada usuario solo ve lo suyo:
//   * usuario (1): sus pósters que pasaron de ronda y sus premios.
//   * evaluador (2): rondas abiertas en las que participa y pendientes.
//   * admin / super admin (3 y 4): estado del corte y del podio.

include_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/RondasHelper.php';
include_once __DIR__ . '/includes/RecordatoriosHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    rh_error(405, 'Método no permitido.', 'metodo_no_permitido');
}

$auth = require_login();
$id_usuario = intval($auth['id']);
$rol = intval($auth['rol']);
$lista = [];

// Verificar si algún horario programado de recordatorio ya venció hoy y dispararlo
rec_verificar_y_disparar_programados($conexion, false);

// ---------------------------------------------------------------------------
// Autor (usuario o evaluador que subió póster): avance de sus pósters y cambios de espacio
// ---------------------------------------------------------------------------
if ($rol === 1 || $rol === 2) {
    $sql = "SELECT p.id AS id_poster, p.titulo, s.lugar, s.premio,
                   r.id_ronda, r.numero, r.nombre AS nombre_ronda
            FROM selecciones s
            JOIN cargar_posters p ON p.id = s.id_poster
            JOIN rondas r ON r.id_ronda = s.id_ronda
            WHERE p.id_usuario = ? AND p.activo = 1
            ORDER BY r.numero ASC";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_usuario);
    $stmt->execute();
    $resultado = $stmt->get_result();
    while ($fila = $resultado->fetch_assoc()) {
        if ($fila['lugar'] !== null) {
            $lista[] = [
                'id' => 'premio-' . $fila['id_poster'] . '-' . $fila['id_ronda'],
                'icon' => '🏆',
                'titulo' => 'Obtuviste el ' . rh_escapar($fila['premio'] ?: (rh_titulo_premio($fila['lugar']))),
                'desc' => 'Póster "' . rh_escapar(mb_substr($fila['titulo'], 0, 28)) . '"',
                'ancla' => 'posters',
            ];
        } else {
            $lista[] = [
                'id' => 'paso-' . $fila['id_poster'] . '-' . $fila['id_ronda'],
                'icon' => '🎉',
                'titulo' => 'Tu póster pasó a la ronda ' . intval($fila['numero']),
                'desc' => 'Póster "' . rh_escapar(mb_substr($fila['titulo'], 0, 28)) . '"',
                'ancla' => 'posters',
            ];
        }
    }
    $stmt->close();

    // Cambios de espacio en los propios pósters del autor
    rh_asegurar_tabla_cambios_espacio($conexion);
    $sqlCambiosAutor = "SELECT c.id_cambio, c.id_poster, p.titulo,
                               c.espacio_anterior, c.espacio_nuevo, c.numero_nuevo
                        FROM cambios_espacio_log c
                        JOIN cargar_posters p ON p.id = c.id_poster
                        WHERE p.id_usuario = ? AND p.activo = 1 AND c.espacio_anterior IS NOT NULL
                        ORDER BY c.id_cambio DESC
                        LIMIT 10";
    $stmtCA = $conexion->prepare($sqlCambiosAutor);
    if ($stmtCA) {
        $stmtCA->bind_param("i", $id_usuario);
        $stmtCA->execute();
        $resCA = $stmtCA->get_result();
        while ($c = $resCA->fetch_assoc()) {
            $etiquetaNueva = trim($c['espacio_nuevo'] . (!empty($c['numero_nuevo']) ? ' #' . intval($c['numero_nuevo']) : ''));
            $lista[] = [
                'id' => 'cambio-espacio-autor-' . intval($c['id_cambio']),
                'tipo' => 'cambio-espacio',
                'icon' => '🔄',
                'titulo' => 'Tu póster cambió de espacio a ' . rh_escapar($etiquetaNueva),
                'desc' => 'Antes: ' . rh_escapar($c['espacio_anterior']) . ' · "' . rh_escapar(mb_substr($c['titulo'], 0, 24)) . '"',
                'ancla' => $rol === 2 ? 'mis-publicaciones' : 'posters',
            ];
        }
        $stmtCA->close();
    }
}

// ---------------------------------------------------------------------------
// Evaluador: rondas abiertas, pendientes por calificar y cambios de espacio en pósters asignados
// ---------------------------------------------------------------------------
if ($rol === 2) {
    $sql = "SELECT r.id_ronda, r.id_evento, r.numero, r.nombre, r.estado, ev.nombre_evento
            FROM rondas r
            JOIN eventos ev ON ev.id_evento = r.id_evento
            WHERE r.estado = 'abierta'
            ORDER BY ev.activo DESC, r.numero ASC";
    $resultado = $conexion->query($sql);
    $rondasAbiertas = [];
    while ($fila = $resultado->fetch_assoc()) {
        $rondasAbiertas[] = $fila;
    }

    // Mensaje personalizado más reciente de recordatorios (si existe)
    $mensajeRecordatorioConfig = '';
    $resMsgCfg = $conexion->query(
        "SELECT mensaje_personalizado FROM recordatorios_config
         WHERE accion = 'recordatorio' AND activo = 1
         ORDER BY hora ASC LIMIT 1"
    );
    if ($resMsgCfg && $rowMsgCfg = $resMsgCfg->fetch_assoc()) {
        $mensajeRecordatorioConfig = trim((string)$rowMsgCfg['mensaje_personalizado']);
    }

    foreach ($rondasAbiertas as $ronda) {
        $id_ronda = intval($ronda['id_ronda']);
        $participa = false;

        $sql = "SELECT COUNT(*) FROM asignaciones_evaluadores
                WHERE id_evaluador = ? AND id_ronda = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("ii", $id_usuario, $id_ronda);
        $stmt->execute();
        $fila = $stmt->get_result()->fetch_row();
        $stmt->close();
        $participa = intval($fila[0]) > 0;

        if (!$participa) continue;

        // Consultar el listado exacto de pósters que le faltan por calificar en esta ronda
        // incluyendo título, nombre del espacio y número del espacio (#N)
        $sqlPend = "SELECT p.id, p.titulo, e.nombre_espacio,
                           CASE
                               WHEN p.id_espacio IS NOT NULL THEN (
                                   COALESCE((
                                       SELECT SUM(e_prev.capacidad)
                                       FROM espacios_fisicos e_prev
                                       WHERE e_prev.id_evento = e.id_evento
                                         AND e_prev.id_espacio < e.id_espacio
                                   ), 0) + (
                                       SELECT COUNT(*)
                                       FROM cargar_posters p2
                                       WHERE p2.id_espacio = p.id_espacio AND p2.id <= p.id AND p2.activo = 1
                                   )
                               )
                               ELSE NULL
                           END AS numero_espacio
                    FROM asignaciones_evaluadores a
                    JOIN cargar_posters p ON p.id = a.id_poster
                    LEFT JOIN espacios_fisicos e ON e.id_espacio = p.id_espacio
                    WHERE a.id_evaluador = ? AND a.id_ronda = ? AND p.id_usuario <> ? AND p.activo = 1
                      AND NOT EXISTS (
                          SELECT 1 FROM poster_profesores pp
                          WHERE pp.id_poster = a.id_poster AND pp.id_usuario = a.id_evaluador
                      )
                      AND NOT EXISTS (
                          SELECT 1 FROM evaluaciones_detalles d
                          WHERE d.id_poster = a.id_poster
                            AND d.id_evaluador = ?
                            AND d.id_ronda = ?
                            AND d.calificacion > 0
                      )
                    ORDER BY p.id ASC";
        $stmtP = $conexion->prepare($sqlPend);
        $stmtP->bind_param("iiiii", $id_usuario, $id_ronda, $id_usuario, $id_usuario, $id_ronda);
        $stmtP->execute();
        $resP = $stmtP->get_result();
        $postersFaltantes = [];
        while ($fp = $resP->fetch_assoc()) {
            $nomEsp = !empty($fp['nombre_espacio']) ? $fp['nombre_espacio'] : null;
            $numEsp = $fp['numero_espacio'] !== null ? max(1, intval($fp['numero_espacio'])) : null;
            $etiquetaEsp = ($nomEsp !== null && $numEsp !== null)
                ? "{$nomEsp} #{$numEsp}"
                : 'Sin ubicar todavía';
            $postersFaltantes[] = '"' . $fp['titulo'] . '" (📍 ' . $etiquetaEsp . ')';
        }
        $stmtP->close();
        $pendientes = count($postersFaltantes);

        $lista[] = [
            'id' => 'ronda-abierta-' . $id_ronda,
            'icon' => '🔔',
            'titulo' => 'Se abrió la ' . rh_escapar($ronda['nombre']),
            'desc' => rh_escapar($ronda['nombre_evento'] ?? ''),
            'ancla' => 'posters',
        ];

        // Solo emitir recordatorio/notificación de pendientes si REALMENTE faltan pósters por calificar
        if ($pendientes > 0) {
            $resumenPosters = implode(' · ', $postersFaltantes);
            $prefijoMsg = $mensajeRecordatorioConfig !== '' ? ($mensajeRecordatorioConfig . ' — ') : '';
            $lista[] = [
                'id' => 'pendientes-' . $id_ronda . '-' . $pendientes,
                'icon' => '✏️',
                'titulo' => 'Tienes ' . $pendientes . ' ' . ($pendientes === 1 ? 'póster pendiente' : 'pósters pendientes') . ' por calificar (' . rh_escapar($ronda['nombre']) . ')',
                'desc' => rh_escapar($prefijoMsg . 'Faltan: ' . $resumenPosters),
                'ancla' => 'posters',
            ];
        }
    }

    // Recordatorios enviados hoy al evaluador (solo se muestran si el evaluador AÚN tiene pósters pendientes)
    $estadoEval = rec_obtener_pendientes_evaluadores($conexion);
    $misPendientesActuales = [];
    foreach ($estadoEval['evaluadores'] as $evInfo) {
        if (intval($evInfo['id_evaluador']) === $id_usuario) {
            $misPendientesActuales = $evInfo['posters'];
            break;
        }
    }

    if (!empty($misPendientesActuales)) {
        $itemsActualesTxt = [];
        foreach ($misPendientesActuales as $mp) {
            $itemsActualesTxt[] = '"' . $mp['titulo'] . '" (📍 ' . $mp['etiqueta_espacio'] . ')';
        }
        $resumenActual = implode(' · ', $itemsActualesTxt);
        $cantActual = count($misPendientesActuales);

        $stmtRN = $conexion->prepare(
            "SELECT id_notif, hora_recordatorio, asunto, mensaje_personalizado
             FROM recordatorios_notificaciones
             WHERE id_evaluador = ? AND DATE(fecha_envio) = CURDATE()
             ORDER BY id_notif DESC
             LIMIT 3"
        );
        if ($stmtRN) {
            $stmtRN->bind_param("i", $id_usuario);
            $stmtRN->execute();
            $resRN = $stmtRN->get_result();
            while ($rn = $resRN->fetch_assoc()) {
                $horaTxt = !empty($rn['hora_recordatorio']) ? " [{$rn['hora_recordatorio']}]" : '';
                $lista[] = [
                    'id' => 'recordatorio-enviado-' . intval($rn['id_notif']),
                    'tipo' => 'recordatorio',
                    'icon' => '⏰',
                    'titulo' => rh_escapar($rn['asunto']) . $horaTxt . " — Faltan {$cantActual} por calificar",
                    'desc' => rh_escapar(trim($rn['mensaje_personalizado']) . ' · Pendientes: ' . $resumenActual),
                    'ancla' => 'posters',
                ];
            }
            $stmtRN->close();
        }
    }

    // Cambios de espacio en los pósters asignados al evaluador
    rh_asegurar_tabla_cambios_espacio($conexion);
    $sqlCambiosEval = "SELECT DISTINCT c.id_cambio, c.id_poster, p.titulo,
                              c.espacio_anterior, c.espacio_nuevo, c.numero_nuevo
                       FROM cambios_espacio_log c
                       JOIN cargar_posters p ON p.id = c.id_poster
                       JOIN asignaciones_evaluadores a ON a.id_poster = c.id_poster
                       WHERE a.id_evaluador = ? AND p.id_usuario <> ? AND p.activo = 1
                         AND c.espacio_anterior IS NOT NULL
                       ORDER BY c.id_cambio DESC
                       LIMIT 10";
    $stmtCE = $conexion->prepare($sqlCambiosEval);
    if ($stmtCE) {
        $stmtCE->bind_param("ii", $id_usuario, $id_usuario);
        $stmtCE->execute();
        $resCE = $stmtCE->get_result();
        while ($c = $resCE->fetch_assoc()) {
            $etiquetaNueva = trim($c['espacio_nuevo'] . (!empty($c['numero_nuevo']) ? ' #' . intval($c['numero_nuevo']) : ''));
            $lista[] = [
                'id' => 'cambio-espacio-eval-' . intval($c['id_cambio']),
                'tipo' => 'cambio-espacio',
                'icon' => '📍',
                'titulo' => 'Póster asignado reubicado a ' . rh_escapar($etiquetaNueva),
                'desc' => 'Antes: ' . rh_escapar($c['espacio_anterior']) . ' · "' . rh_escapar(mb_substr($c['titulo'], 0, 24)) . '"',
                'ancla' => 'posters',
            ];
        }
        $stmtCE->close();
    }
}

// ---------------------------------------------------------------------------
// Admin / Super Admin: corte y podio (Admin solo ve su evento; Super Admin ve todos)
// ---------------------------------------------------------------------------
if (in_array($rol, [3, 4], true)) {
    $idEvAdmin = auth_id_evento_admin($conexion, $auth);
    $condEv = ($idEvAdmin !== null && $idEvAdmin > 0)
        ? "r.id_evento = " . intval($idEvAdmin)
        : "ev.activo = 1";
    $sql = "SELECT r.id_ronda, r.numero, r.nombre, ev.nombre_evento,
                   (SELECT COUNT(*) FROM selecciones s WHERE s.id_ronda = r.id_ronda) AS n_selecciones,
                   (SELECT COUNT(*) FROM selecciones s WHERE s.id_ronda = r.id_ronda AND s.lugar IS NOT NULL) AS n_ganadores
            FROM rondas r
            JOIN eventos ev ON ev.id_evento = r.id_evento
            WHERE {$condEv}
            ORDER BY r.numero ASC";
    $resultado = $conexion->query($sql);
    while ($fila = $resultado->fetch_assoc()) {
        $etiquetaRonda = $fila['nombre'] . (!empty($fila['nombre_evento']) ? ' · ' . $fila['nombre_evento'] : '');
        if (intval($fila['n_selecciones']) > 0) {
            $lista[] = [
                'id' => 'corte-' . $fila['id_ronda'],
                'icon' => '✂️',
                'titulo' => 'Corte confirmado: ' . intval($fila['n_selecciones']) . ' pósters pasaron de ronda',
                'desc' => rh_escapar($etiquetaRonda),
                'ancla' => 'rondas',
            ];
        }
        if (intval($fila['n_ganadores']) > 0) {
            $lista[] = [
                'id' => 'podio-' . $fila['id_ronda'],
                'icon' => '🏆',
                'titulo' => 'Podio publicado: ' . intval($fila['n_ganadores']) . ' ganadores',
                'desc' => rh_escapar($etiquetaRonda),
                'ancla' => 'rondas',
            ];
        }
    }
}

echo json_encode([
    'success' => true,
    'data' => $lista,
    'count' => count($lista),
]);
?>
