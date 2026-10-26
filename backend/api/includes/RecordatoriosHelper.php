<?php
// backend/api/includes/RecordatoriosHelper.php
// Lógica centralizada de la Fase 5:
//   - Horarios y mensajes de recordatorio configurables por Admin y Super Admin
//   - Verificación previa de pósters pendientes (si no faltan pósters, no envía nada)
//   - Inclusión obligatoria de: cantidad pendiente + títulos + espacio físico con #N
//   - Acciones complementarias: asignar pósters huérfanos, reasignar a evaluadores libres e informe

include_once __DIR__ . '/RondasHelper.php';
include_once __DIR__ . '/PostersHelper.php';
include_once __DIR__ . '/Correos.php';

/**
 * Asegura la existencia de las tablas de configuración, bitácora y notificaciones de recordatorios.
 */
function rec_asegurar_tablas($conexion)
{
    static $verificado = false;
    if ($verificado) return;

    $conexion->query("
        CREATE TABLE IF NOT EXISTS `recordatorios_config` (
          `id_config` INT(11) NOT NULL AUTO_INCREMENT,
          `carrera` VARCHAR(20) NOT NULL DEFAULT 'sistemas',
          `hora` VARCHAR(5) NOT NULL,
          `accion` VARCHAR(40) NOT NULL DEFAULT 'recordatorio',
          `asunto` VARCHAR(180) NOT NULL DEFAULT 'Recordatorio de evaluación de pósters',
          `mensaje_personalizado` TEXT NOT NULL,
          `activo` TINYINT(1) NOT NULL DEFAULT 1,
          `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id_config`),
          KEY `idx_hora_activo` (`hora`, `activo`),
          KEY `idx_carrera` (`carrera`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $colCfg = $conexion->query("SHOW COLUMNS FROM `recordatorios_config` LIKE 'carrera'");
    if ($colCfg && $colCfg->num_rows === 0) {
        $conexion->query("ALTER TABLE `recordatorios_config` ADD COLUMN `carrera` VARCHAR(20) NOT NULL DEFAULT 'sistemas' AFTER `id_config`, ADD KEY `idx_carrera` (`carrera`)");
    }

    $conexion->query("
        CREATE TABLE IF NOT EXISTS `recordatorios_log` (
          `id_log` INT(11) NOT NULL AUTO_INCREMENT,
          `id_config` INT(11) DEFAULT NULL,
          `carrera` VARCHAR(20) NOT NULL DEFAULT 'sistemas',
          `fecha` DATE NOT NULL,
          `hora_programada` VARCHAR(5) DEFAULT NULL,
          `accion` VARCHAR(40) NOT NULL,
          `id_ronda` INT(11) DEFAULT NULL,
          `enviados` INT(11) NOT NULL DEFAULT 0,
          `detalle` TEXT DEFAULT NULL,
          `ejecutado_por` VARCHAR(100) DEFAULT NULL,
          `ejecutado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id_log`),
          KEY `idx_fecha_accion` (`fecha`, `accion`, `id_config`),
          KEY `idx_carrera_log` (`carrera`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $colLog = $conexion->query("SHOW COLUMNS FROM `recordatorios_log` LIKE 'carrera'");
    if ($colLog && $colLog->num_rows === 0) {
        $conexion->query("ALTER TABLE `recordatorios_log` ADD COLUMN `carrera` VARCHAR(20) NOT NULL DEFAULT 'sistemas' AFTER `id_config`, ADD KEY `idx_carrera_log` (`carrera`)");
    }

    $conexion->query("
        CREATE TABLE IF NOT EXISTS `recordatorios_notificaciones` (
          `id_notif` INT(11) NOT NULL AUTO_INCREMENT,
          `id_evaluador` INT(11) NOT NULL,
          `id_ronda` INT(11) DEFAULT NULL,
          `hora_recordatorio` VARCHAR(5) DEFAULT NULL,
          `asunto` VARCHAR(180) NOT NULL,
          `mensaje_personalizado` TEXT NOT NULL,
          `cantidad_pendientes` INT(11) NOT NULL DEFAULT 0,
          `resumen_posters` TEXT NOT NULL,
          `fecha_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id_notif`),
          KEY `idx_eval_fecha` (`id_evaluador`, `fecha_envio`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $verificado = true;
}

/**
 * Normaliza el alcance de carrera para recordatorios ('sistemas' o 'civil').
 */
function rec_normalizar_carrera_scope($carreraRaw)
{
    $c = mb_strtolower(trim((string)$carreraRaw), 'UTF-8');
    return (strpos($c, 'civil') !== false) ? 'civil' : 'sistemas';
}

/**
 * Determina a qué carrera pertenecen los recordatorios según el actor autenticado:
 * - Admin de Civil (rol 3 con carrera civil) -> 'civil'
 * - Super Admin (rol 4) y Admin de Sistemas (rol 3 con carrera sistemas) -> 'sistemas'
 */
function rec_resolver_carrera_actor($conexion, $auth = null)
{
    if ($auth === null && function_exists('auth_current')) {
        $auth = auth_current();
    }
    if ($auth && intval($auth['rol'] ?? 0) === 3 && function_exists('auth_carrera_admin')) {
        $cAdmin = auth_carrera_admin($conexion, $auth);
        if ($cAdmin === 'civil') {
            return 'civil';
        }
    }
    return 'sistemas';
}

/**
 * Normaliza una cadena de hora al formato HH:MM (24 horas).
 */
function rec_normalizar_hora($horaRaw)
{
    $h = trim((string)$horaRaw);
    if (preg_match('/^(\d{1,2}):(\d{2})/', $h, $m)) {
        $hh = intval($m[1]);
        $mm = intval($m[2]);
        if ($hh >= 0 && $hh <= 23 && $mm >= 0 && $mm <= 59) {
            return sprintf('%02d:%02d', $hh, $mm);
        }
    }
    return null;
}

/**
 * Consulta todos los evaluadores que tienen pósters pendientes por calificar
 * en rondas abiertas del evento activo filtrado por carrera ('sistemas' o 'civil').
 */
function rec_obtener_pendientes_evaluadores($conexion, $id_evento_filtro = null, $carrera_filtro = 'sistemas')
{
    rec_asegurar_tablas($conexion);

    $carreraScope = rec_normalizar_carrera_scope($carrera_filtro);

    if ($id_evento_filtro !== null && intval($id_evento_filtro) > 0) {
        $filtroEvSql = " AND r.id_evento = " . intval($id_evento_filtro);
    } elseif ($carreraScope === 'civil') {
        $filtroEvSql = " AND ev.activo = 1 AND ev.carrera = 'civil'";
    } else {
        $filtroEvSql = " AND ev.activo = 1 AND (ev.carrera = 'sistemas' OR ev.carrera = 'ambas' OR ev.carrera IS NULL)";
    }

    $filtroEvalCarreraSql = ($carreraScope === 'civil')
        ? " AND LOWER(COALESCE(u.carrera, '')) LIKE '%civil%'"
        : " AND LOWER(COALESCE(u.carrera, '')) NOT LIKE '%civil%'";

    $sql = "SELECT a.id_evaluador,
                   CONCAT(u.nombres, ' ', u.apellidos) AS nombre_evaluador,
                   u.correo,
                   p.id AS id_poster,
                   p.titulo,
                   p.id_espacio,
                   e.nombre_espacio,
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
                   END AS numero_espacio,
                   r.id_ronda,
                   r.numero AS numero_ronda,
                   r.nombre AS nombre_ronda
            FROM asignaciones_evaluadores a
            INNER JOIN rondas r ON r.id_ronda = a.id_ronda
            INNER JOIN eventos ev ON ev.id_evento = r.id_evento
            INNER JOIN cargar_posters p ON p.id = a.id_poster
            INNER JOIN usuario u ON u.id = a.id_evaluador
            LEFT JOIN espacios_fisicos e ON e.id_espacio = p.id_espacio
            WHERE r.estado = 'abierta'
              {$filtroEvSql}
              {$filtroEvalCarreraSql}
              AND p.activo = 1
              AND u.activo = 1 AND u.desactivado = 0
              AND p.id_usuario <> a.id_evaluador
              AND NOT EXISTS (
                  SELECT 1 FROM poster_profesores pp
                  WHERE pp.id_poster = a.id_poster AND pp.id_usuario = a.id_evaluador
              )
              AND NOT EXISTS (
                  SELECT 1 FROM evaluaciones_detalles d
                  WHERE d.id_poster = a.id_poster
                    AND d.id_evaluador = a.id_evaluador
                    AND d.id_ronda = a.id_ronda
                    AND d.calificacion > 0
              )
            ORDER BY u.nombres ASC, r.numero ASC, p.id ASC";

    $res = $conexion->query($sql);
    $evaluadores = [];
    $postersUnicos = [];
    $totalAsignaciones = 0;

    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $idEv = intval($row['id_evaluador']);
            $idPoster = intval($row['id_poster']);
            $postersUnicos[$idPoster] = true;
            $totalAsignaciones++;

            $nomEsp = !empty($row['nombre_espacio']) ? $row['nombre_espacio'] : null;
            $numEsp = $row['numero_espacio'] !== null ? max(1, intval($row['numero_espacio'])) : null;
            $etiquetaEsp = ($nomEsp !== null && $numEsp !== null)
                ? "{$nomEsp} #{$numEsp}"
                : 'Sin ubicar todavía';

            if (!isset($evaluadores[$idEv])) {
                $evaluadores[$idEv] = [
                    'id_evaluador' => $idEv,
                    'nombre' => trim($row['nombre_evaluador']),
                    'correo' => trim((string)$row['correo']),
                    'posters' => [],
                ];
            }

            $evaluadores[$idEv]['posters'][] = [
                'id_poster' => $idPoster,
                'titulo' => $row['titulo'],
                'nombre_espacio' => $nomEsp,
                'numero_espacio' => $numEsp,
                'etiqueta_espacio' => $etiquetaEsp,
                'id_ronda' => intval($row['id_ronda']),
                'numero_ronda' => intval($row['numero_ronda']),
                'nombre_ronda' => $row['nombre_ronda'],
            ];
        }
    }

    return [
        'hay_pendientes' => $totalAsignaciones > 0,
        'total_evaluadores_pendientes' => count($evaluadores),
        'total_asignaciones_pendientes' => $totalAsignaciones,
        'total_posters_pendientes' => count($postersUnicos),
        'evaluadores' => array_values($evaluadores),
    ];
}

/**
 * Construye el cuerpo HTML del correo y el texto resumen de notificación in-app
 * garantizando que SIEMPRE aparezcan:
 *   1) El mensaje personalizado del admin/superadmin
 *   2) El número de pósters que faltan por calificar
 *   3) Los títulos de cada póster pendiente
 *   4) El nombre del espacio físico y el número dentro del espacio (#N)
 */
function rec_construir_contenido_recordatorio($evaluador, $asunto, $mensajePersonalizado, $horaLabel = null)
{
    $posters = $evaluador['posters'] ?? [];
    $cantidad = count($posters);
    $nombreEsc = rh_escapar($evaluador['nombre'] ?? 'Evaluador');
    $msgEsc = nl2br(rh_escapar(trim((string)$mensajePersonalizado)));

    $itemsHtml = '';
    $itemsTexto = [];

    foreach ($posters as $p) {
        $titEsc = rh_escapar($p['titulo']);
        $espEsc = rh_escapar($p['etiqueta_espacio']);
        $rondaEsc = rh_escapar($p['nombre_ronda'] ?: ('Ronda ' . $p['numero_ronda']));
        $itemsHtml .= "<li style='margin-bottom:8px;'>"
            . "<strong>&laquo;{$titEsc}&raquo;</strong> &mdash; "
            . "<span style='display:inline-block;padding:2px 8px;border-radius:999px;background:#e0f4f8;color:#005f73;font-weight:700;'>📍 {$espEsc}</span> "
            . "<small style='color:#64748b;'>({$rondaEsc})</small>"
            . "</li>";
        $itemsTexto[] = "\"{$p['titulo']}\" (📍 {$p['etiqueta_espacio']})";
    }

    $plural = $cantidad === 1 ? '1 póster pendiente' : "{$cantidad} pósters pendientes";
    $horaInfo = $horaLabel ? " <span style='color:#64748b;font-size:13px;'>(Corte {$horaLabel})</span>" : "";

    $cuerpoInterno = "
        <p>Hola, <strong>{$nombreEsc}</strong>.{$horaInfo}</p>
        <p style='margin:12px 0;padding:12px 14px;background:#f8fafc;border-left:4px solid #007B99;border-radius:6px;color:#1e293b;'>
            {$msgEsc}
        </p>
        <p>Actualmente tienes <strong>{$plural} por calificar</strong>:</p>
        <ul style='line-height:1.7;padding-left:20px;margin:12px 0;'>
            {$itemsHtml}
        </ul>
        <p style='margin-top:14px;color:#475569;font-size:13px;'>
            Ingresa a tu panel de evaluador para registrar las calificaciones correspondientes.
        </p>
    ";

    $htmlCorreo = rh_plantilla_correo($asunto, $cuerpoInterno);
    $resumenPostersTexto = implode(' · ', $itemsTexto);

    return [
        'html_correo' => $htmlCorreo,
        'resumen_posters' => $resumenPostersTexto,
        'cantidad' => $cantidad,
    ];
}

/**
 * Ejecuta el envío de recordatorios verificando PRIMERO si faltan pósters por calificar.
 * Si no faltan pósters, NO envía correos ni notificaciones.
 */
function rec_ejecutar_recordatorio($conexion, $opciones = [])
{
    rec_asegurar_tablas($conexion);

    $id_config = isset($opciones['id_config']) && $opciones['id_config'] !== null ? intval($opciones['id_config']) : null;
    $hora = !empty($opciones['hora']) ? $opciones['hora'] : date('H:i');
    $asunto = !empty($opciones['asunto']) ? trim($opciones['asunto']) : 'Recordatorio de evaluación de pósters';
    $mensajePersonalizado = !empty($opciones['mensaje_personalizado'])
        ? trim($opciones['mensaje_personalizado'])
        : 'Te recordamos revisar y calificar los pósters que tienes pendientes en la ronda actual.';
    $ejecutadoPor = !empty($opciones['ejecutado_por']) ? $opciones['ejecutado_por'] : 'sistema';
    $enviarSincrono = !empty($opciones['sincrono']);
    $id_evento_filtro = isset($opciones['id_evento']) && intval($opciones['id_evento']) > 0 ? intval($opciones['id_evento']) : null;
    $carreraScope = rec_normalizar_carrera_scope($opciones['carrera'] ?? 'sistemas');

    // 1. Verificar primero si faltan pósters por calificar en esa carrera/evento
    $estadoPendientes = rec_obtener_pendientes_evaluadores($conexion, $id_evento_filtro, $carreraScope);

    if (!$estadoPendientes['hay_pendientes'] || empty($estadoPendientes['evaluadores'])) {
        $detalle = 'Verificación realizada: no faltan pósters por calificar. No se envió ningún recordatorio.';
        $stmtLog = $conexion->prepare(
            "INSERT INTO recordatorios_log (id_config, carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por)
             VALUES (?, ?, CURDATE(), ?, 'recordatorio', 0, ?, ?)"
        );
        if ($stmtLog) {
            $stmtLog->bind_param("issss", $id_config, $carreraScope, $hora, $detalle, $ejecutadoPor);
            $stmtLog->execute();
            $stmtLog->close();
        }

        return [
            'status' => 'sin_pendientes',
            'hay_pendientes' => false,
            'enviados' => 0,
            'total_posters_pendientes' => 0,
            'lote_correos' => [],
            'message' => 'No faltan pósters por calificar en las rondas abiertas. No se envió ningún recordatorio.',
        ];
    }

    // 2. Preparar correos y notificaciones en campana solo para evaluadores con pendientes
    $loteCorreos = [];
    $enviados = 0;

    $stmtNotif = $conexion->prepare(
        "INSERT INTO recordatorios_notificaciones
         (id_evaluador, id_ronda, hora_recordatorio, asunto, mensaje_personalizado, cantidad_pendientes, resumen_posters)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    foreach ($estadoPendientes['evaluadores'] as $ev) {
        if (empty($ev['posters'])) continue;

        $contenido = rec_construir_contenido_recordatorio($ev, $asunto, $mensajePersonalizado, $hora);
        $primeraRonda = intval($ev['posters'][0]['id_ronda'] ?? 0);
        $asuntoCorreo = "{$asunto} ({$contenido['cantidad']} pendiente" . ($contenido['cantidad'] === 1 ? '' : 's') . ")";

        if ($stmtNotif) {
            $idEvInt = intval($ev['id_evaluador']);
            $cantInt = intval($contenido['cantidad']);
            $resumenStr = $contenido['resumen_posters'];
            $stmtNotif->bind_param(
                "iisssis",
                $idEvInt,
                $primeraRonda,
                $hora,
                $asunto,
                $mensajePersonalizado,
                $cantInt,
                $resumenStr
            );
            $stmtNotif->execute();
        }

        if (!empty($ev['correo'])) {
            $loteCorreos[] = [
                'correo' => $ev['correo'],
                'asunto' => $asuntoCorreo,
                'cuerpo' => $contenido['html_correo'],
            ];
            if ($enviarSincrono) {
                enviarCorreo($ev['correo'], $asuntoCorreo, $contenido['html_correo']);
            }
        }
        $enviados++;
    }

    if ($stmtNotif) $stmtNotif->close();

    $detalleLog = "Recordatorio enviado a {$enviados} evaluador(es) con {$estadoPendientes['total_posters_pendientes']} póster(s) pendiente(s).";
    $stmtLog = $conexion->prepare(
        "INSERT INTO recordatorios_log (id_config, carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por)
         VALUES (?, ?, CURDATE(), ?, 'recordatorio', ?, ?, ?)"
    );
    if ($stmtLog) {
        $stmtLog->bind_param("ississ", $id_config, $carreraScope, $hora, $enviados, $detalleLog, $ejecutadoPor);
        $stmtLog->execute();
        $stmtLog->close();
    }

    return [
        'status' => 'success',
        'hay_pendientes' => true,
        'enviados' => $enviados,
        'total_posters_pendientes' => $estadoPendientes['total_posters_pendientes'],
        'total_asignaciones_pendientes' => $estadoPendientes['total_asignaciones_pendientes'],
        'lote_correos' => $loteCorreos,
        'message' => $detalleLog,
    ];
}

/**
 * Acción Fase 5: Asignar aleatoriamente evaluadores a pósters que aún no tienen ningún evaluador en Ronda 1.
 */
function rec_ejecutar_asignar_huerfanos($conexion, $ejecutadoPor = 'sistema', $enviarSincrono = false, $id_evento_filtro = null, $carrera_filtro = 'sistemas')
{
    rec_asegurar_tablas($conexion);

    $carreraScope = rec_normalizar_carrera_scope($carrera_filtro);

    if ($id_evento_filtro !== null && intval($id_evento_filtro) > 0) {
        $filtroEvSql = " AND (p.id_evento = " . intval($id_evento_filtro) . " OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = " . intval($id_evento_filtro) . "))";
    } elseif ($carreraScope === 'civil') {
        $filtroEvSql = " AND ev.activo = 1 AND ev.carrera = 'civil'";
    } else {
        $filtroEvSql = " AND ev.activo = 1 AND (ev.carrera = 'sistemas' OR ev.carrera = 'ambas' OR ev.carrera IS NULL)";
    }

    $sql = "SELECT p.id, p.id_usuario, p.id_evento, p.categoria, p.id_espacio, p.titulo
            FROM cargar_posters p
            INNER JOIN eventos ev ON ev.id_evento = p.id_evento
            WHERE p.activo = 1 {$filtroEvSql}
              AND NOT EXISTS (
                  SELECT 1 FROM asignaciones_evaluadores a WHERE a.id_poster = p.id
              )";
    $res = $conexion->query($sql);
    $asignados = 0;
    $loteCorreos = [];

    if ($res) {
        while ($p = $res->fetch_assoc()) {
            $idPoster = intval($p['id']);
            // Obtener profesores vinculados para no asignarlos como evaluadores si hay otros disponibles
            $idsProfs = [];
            $resP = $conexion->query("SELECT id_usuario FROM poster_profesores WHERE id_poster = {$idPoster}");
            if ($resP) {
                while ($rp = $resP->fetch_assoc()) $idsProfs[] = intval($rp['id_usuario']);
            }
            $r = ph_asignar_evaluadores_al_subir(
                $conexion,
                $idPoster,
                intval($p['id_evento']),
                intval($p['id_usuario']),
                (string)$p['titulo'],
                (string)$p['categoria'],
                $idsProfs,
                $p['id_espacio'],
                2
            );
            if (!empty($r['evaluadores'])) {
                $asignados++;
                foreach ($r['notificaciones'] as $n) {
                    $loteCorreos[] = [
                        'correo' => $n['correo'],
                        'asunto' => $n['asunto'],
                        'cuerpo' => $n['mensaje'],
                    ];
                    if ($enviarSincrono && !empty($n['correo'])) {
                        enviarCorreo($n['correo'], $n['asunto'], $n['mensaje']);
                    }
                }
            }
        }
    }

    $detalle = $asignados > 0
        ? "Se asignaron evaluadores automáticamente a {$asignados} póster(s) que estaban sin evaluador."
        : "Todos los pósters activos ya cuentan con evaluadores asignados.";

    $hora = date('H:i');
    $stmtLog = $conexion->prepare(
        "INSERT INTO recordatorios_log (carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por)
         VALUES (?, CURDATE(), ?, 'asignar', ?, ?, ?)"
    );
    if ($stmtLog) {
        $stmtLog->bind_param("ssiss", $carreraScope, $hora, $asignados, $detalle, $ejecutadoPor);
        $stmtLog->execute();
        $stmtLog->close();
    }

    return [
        'status' => 'success',
        'asignados' => $asignados,
        'lote_correos' => $loteCorreos,
        'message' => $detalle,
    ];
}

/**
 * Acción Fase 5: Reasignar pósters sin calificar en rondas abiertas a evaluadores libres
 * (que ya terminaron sus pósters asignados), excluyendo al autor y a quien ya calificó ese póster.
 */
function rec_ejecutar_reasignar_pendientes($conexion, $ejecutadoPor = 'sistema', $enviarSincrono = false, $id_evento_filtro = null, $carrera_filtro = 'sistemas')
{
    rec_asegurar_tablas($conexion);

    $carreraScope = rec_normalizar_carrera_scope($carrera_filtro);

    if ($id_evento_filtro !== null && intval($id_evento_filtro) > 0) {
        $filtroEvSql = " AND r.id_evento = " . intval($id_evento_filtro);
    } elseif ($carreraScope === 'civil') {
        $filtroEvSql = " AND ev.activo = 1 AND ev.carrera = 'civil'";
    } else {
        $filtroEvSql = " AND ev.activo = 1 AND (ev.carrera = 'sistemas' OR ev.carrera = 'ambas' OR ev.carrera IS NULL)";
    }

    $filtroEvalCarreraSql = ($carreraScope === 'civil')
        ? " AND LOWER(COALESCE(u.carrera, '')) LIKE '%civil%'"
        : " AND LOWER(COALESCE(u.carrera, '')) NOT LIKE '%civil%'";

    $sqlPend = "SELECT a.id_asignacion, a.id_poster, a.id_evaluador AS id_eval_anterior, a.id_ronda,
                       p.titulo, p.id_usuario AS id_autor, p.id_espacio
                FROM asignaciones_evaluadores a
                INNER JOIN rondas r ON r.id_ronda = a.id_ronda
                INNER JOIN eventos ev ON ev.id_evento = r.id_evento
                INNER JOIN cargar_posters p ON p.id = a.id_poster
                WHERE r.estado = 'abierta' {$filtroEvSql} AND p.activo = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM evaluaciones_detalles d
                      WHERE d.id_poster = a.id_poster
                        AND d.id_evaluador = a.id_evaluador
                        AND d.id_ronda = a.id_ronda
                        AND d.calificacion > 0
                  )";
    $resPend = $conexion->query($sqlPend);
    if (!$resPend || $resPend->num_rows === 0) {
        $detalle = "No hay pósters sin calificar que requieran reasignación.";
        $hora = date('H:i');
        $stmtLog = $conexion->prepare(
            "INSERT INTO recordatorios_log (carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por)
             VALUES (?, CURDATE(), ?, 'reasignar', 0, ?, ?)"
        );
        if ($stmtLog) {
            $stmtLog->bind_param("ssss", $carreraScope, $hora, $detalle, $ejecutadoPor);
            $stmtLog->execute();
            $stmtLog->close();
        }
        return [
            'status' => 'sin_pendientes',
            'reasignados' => 0,
            'lote_correos' => [],
            'message' => $detalle,
        ];
    }

    $reasignados = 0;
    $loteCorreos = [];

    while ($fila = $resPend->fetch_assoc()) {
        $idPoster = intval($fila['id_poster']);
        $idRonda = intval($fila['id_ronda']);
        $idAutor = intval($fila['id_autor']);
        $idAsignacion = intval($fila['id_asignacion']);

        // Buscar un evaluador activo de la misma carrera que NO sea el autor, que NO esté ya asignado a este póster en esta ronda,
        // y priorizar a los evaluadores que ya terminaron sus pendientes en la ronda actual (pendientes_ronda = 0).
        $sqlLibre = "SELECT u.id, u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_eval,
                            (SELECT COUNT(*)
                             FROM asignaciones_evaluadores ae
                             JOIN cargar_posters p2 ON p2.id = ae.id_poster
                             WHERE ae.id_evaluador = u.id AND ae.id_ronda = ? AND p2.activo = 1
                               AND NOT EXISTS (
                                   SELECT 1 FROM evaluaciones_detalles d2
                                   WHERE d2.id_poster = ae.id_poster
                                     AND d2.id_evaluador = u.id
                                     AND d2.id_ronda = ae.id_ronda
                                     AND d2.calificacion > 0
                               )
                            ) AS pendientes_ronda
                     FROM usuario u
                     WHERE u.id_rol = 2 AND u.activo = 1 AND u.desactivado = 0
                       {$filtroEvalCarreraSql}
                       AND u.id <> ?
                       AND NOT EXISTS (
                           SELECT 1 FROM asignaciones_evaluadores ax
                           WHERE ax.id_poster = ? AND ax.id_ronda = ? AND ax.id_evaluador = u.id
                       )
                       AND NOT EXISTS (
                           SELECT 1 FROM poster_profesores pp
                           WHERE pp.id_poster = ? AND pp.id_usuario = u.id
                       )
                     ORDER BY pendientes_ronda ASC, RAND()
                     LIMIT 1";
        $stmtL = $conexion->prepare($sqlLibre);
        if (!$stmtL) continue;
        $stmtL->bind_param("iiiii", $idRonda, $idAutor, $idPoster, $idRonda, $idPoster);
        $stmtL->execute();
        $cand = $stmtL->get_result()->fetch_assoc();
        $stmtL->close();

        if ($cand) {
            $nuevoEvalId = intval($cand['id']);
            $stmtUp = $conexion->prepare("UPDATE asignaciones_evaluadores SET id_evaluador = ? WHERE id_asignacion = ?");
            if ($stmtUp) {
                $stmtUp->bind_param("ii", $nuevoEvalId, $idAsignacion);
                if ($stmtUp->execute()) {
                    $reasignados++;
                    $ubi = rh_ubicacion_poster($conexion, $idPoster);
                    $etiquetaEsp = $ubi['etiqueta'];
                    if (!empty($cand['correo'])) {
                        $nomEsc = rh_escapar($cand['nombre_eval']);
                        $titEsc = rh_escapar($fila['titulo']);
                        $espEsc = rh_escapar($etiquetaEsp);
                        $asunto = "Póster reasignado para evaluación";
                        $cuerpo = rh_plantilla_correo(
                            $asunto,
                            "<p>Hola, <strong>{$nomEsc}</strong>.</p>"
                            . "<p>Se te ha reasignado el póster <strong>&laquo;{$titEsc}&raquo;</strong> para evaluar en la ronda actual.</p>"
                            . "<p><strong>Ubicación física:</strong> 📍 {$espEsc}</p>"
                        );
                        $loteCorreos[] = [
                            'correo' => $cand['correo'],
                            'asunto' => $asunto,
                            'cuerpo' => $cuerpo,
                        ];
                        if ($enviarSincrono) {
                            enviarCorreo($cand['correo'], $asunto, $cuerpo);
                        }
                    }
                }
                $stmtUp->close();
            }
        }
    }

    $detalle = $reasignados > 0
        ? "Se reasignaron {$reasignados} evaluación(es) pendiente(s) a evaluadores disponibles."
        : "No se encontraron evaluadores alternativos disponibles para reasignar.";

    $hora = date('H:i');
    $stmtLog = $conexion->prepare(
        "INSERT INTO recordatorios_log (carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por)
         VALUES (?, CURDATE(), ?, 'reasignar', ?, ?, ?)"
    );
    if ($stmtLog) {
        $stmtLog->bind_param("ssiss", $carreraScope, $hora, $reasignados, $detalle, $ejecutadoPor);
        $stmtLog->execute();
        $stmtLog->close();
    }

    return [
        'status' => 'success',
        'reasignados' => $reasignados,
        'lote_correos' => $loteCorreos,
        'message' => $detalle,
    ];
}

/**
 * Acción Fase 5: Generar informe consolidado de estado (pósters totales, calificados, pendientes, evaluadores).
 */
function rec_generar_informe($conexion, $registrarLog = false, $ejecutadoPor = 'sistema', $id_evento_filtro = null, $carrera_filtro = 'sistemas')
{
    rec_asegurar_tablas($conexion);

    $carreraScope = rec_normalizar_carrera_scope($carrera_filtro);

    if ($id_evento_filtro !== null && intval($id_evento_filtro) > 0) {
        $idEvInt = intval($id_evento_filtro);
        $resTot = $conexion->query("
            SELECT COUNT(*) AS total_posters
            FROM cargar_posters p
            WHERE p.activo = 1
              AND (p.id_evento = {$idEvInt} OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = {$idEvInt}))
        ");
    } elseif ($carreraScope === 'civil') {
        $resTot = $conexion->query("
            SELECT COUNT(*) AS total_posters
            FROM cargar_posters p
            JOIN eventos ev ON ev.id_evento = p.id_evento
            WHERE p.activo = 1 AND ev.activo = 1 AND ev.carrera = 'civil'
        ");
    } else {
        $resTot = $conexion->query("
            SELECT COUNT(*) AS total_posters
            FROM cargar_posters p
            JOIN eventos ev ON ev.id_evento = p.id_evento
            WHERE p.activo = 1 AND ev.activo = 1 AND (ev.carrera = 'sistemas' OR ev.carrera = 'ambas' OR ev.carrera IS NULL)
        ");
    }
    $totalPosters = $resTot ? intval($resTot->fetch_assoc()['total_posters']) : 0;

    $pendientesInfo = rec_obtener_pendientes_evaluadores($conexion, $id_evento_filtro, $carreraScope);
    $postersPendientes = $pendientesInfo['total_posters_pendientes'];
    $postersCalificados = max(0, $totalPosters - $postersPendientes);

    $condEvalCarrera = ($carreraScope === 'civil')
        ? "AND LOWER(COALESCE(carrera, '')) LIKE '%civil%'"
        : "AND LOWER(COALESCE(carrera, '')) NOT LIKE '%civil%'";
    $resEvTot = $conexion->query("SELECT COUNT(*) AS total_evals FROM usuario WHERE id_rol = 2 AND activo = 1 AND desactivado = 0 {$condEvalCarrera}");
    $totalEvaluadores = $resEvTot ? intval($resEvTot->fetch_assoc()['total_evals']) : 0;
    $evalsConPendientes = $pendientesInfo['total_evaluadores_pendientes'];
    $evalsAlDia = max(0, $totalEvaluadores - $evalsConPendientes);

    $detalle = "Informe: {$totalPosters} pósters activos ({$postersCalificados} al día, {$postersPendientes} con calificaciones pendientes) · {$totalEvaluadores} evaluadores ({$evalsAlDia} al día, {$evalsConPendientes} con pendientes).";

    if ($registrarLog) {
        $hora = date('H:i');
        $stmtLog = $conexion->prepare(
            "INSERT INTO recordatorios_log (carrera, fecha, hora_programada, accion, enviados, detalle, ejecutado_por)
             VALUES (?, CURDATE(), ?, 'informe', ?, ?, ?)"
        );
        if ($stmtLog) {
            $stmtLog->bind_param("ssiss", $carreraScope, $hora, $postersPendientes, $detalle, $ejecutadoPor);
            $stmtLog->execute();
            $stmtLog->close();
        }
    }

    return [
        'total_posters' => $totalPosters,
        'posters_al_dia' => $postersCalificados,
        'posters_pendientes' => $postersPendientes,
        'total_asignaciones_pendientes' => $pendientesInfo['total_asignaciones_pendientes'],
        'total_evaluadores' => $totalEvaluadores,
        'evaluadores_al_dia' => $evalsAlDia,
        'evaluadores_con_pendientes' => $evalsConPendientes,
        'detalle' => $detalle,
        'evaluadores_detalle' => $pendientesInfo['evaluadores'],
        'carrera' => $carreraScope,
    ];
}

/**
 * Verifica si hay horarios activos en `recordatorios_config` cuya hora ya llegó hoy
 * y aún no se han ejecutado en la fecha actual (`recordatorios_log`).
 * Si corresponde, los ejecuta automáticamente respetando la carrera de cada horario.
 */
function rec_verificar_y_disparar_programados($conexion, $enviarSincrono = false, $carrera_filtro = null)
{
    rec_asegurar_tablas($conexion);

    $horaActual = date('H:i');
    $condCarrera = "";
    if ($carrera_filtro !== null && trim((string)$carrera_filtro) !== '') {
        $cNorm = rec_normalizar_carrera_scope($carrera_filtro);
        $condCarrera = " AND c.carrera = '" . $conexion->real_escape_string($cNorm) . "'";
    }

    $sql = "SELECT c.*
            FROM recordatorios_config c
            WHERE c.activo = 1
              {$condCarrera}
              AND c.hora <= ?
              AND NOT EXISTS (
                  SELECT 1 FROM recordatorios_log l
                  WHERE l.fecha = CURDATE()
                    AND l.id_config = c.id_config
              )
            ORDER BY c.hora ASC";

    $stmt = $conexion->prepare($sql);
    if (!$stmt) return [];
    $stmt->bind_param("s", $horaActual);
    $stmt->execute();
    $res = $stmt->get_result();
    $pendientesDisparo = [];
    while ($row = $res->fetch_assoc()) {
        $pendientesDisparo[] = $row;
    }
    $stmt->close();

    $resultados = [];
    foreach ($pendientesDisparo as $cfg) {
        $accion = $cfg['accion'] ?: 'recordatorio';
        $idCfg = intval($cfg['id_config']);
        $carreraCfg = rec_normalizar_carrera_scope($cfg['carrera'] ?? 'sistemas');
        if ($accion === 'asignar') {
            $r = rec_ejecutar_asignar_huerfanos($conexion, 'horario:' . $cfg['hora'], $enviarSincrono, null, $carreraCfg);
            $conexion->query("UPDATE recordatorios_log SET id_config = {$idCfg} WHERE id_log = LAST_INSERT_ID()");
            $resultados[] = $r;
        } elseif ($accion === 'reasignar') {
            $r = rec_ejecutar_reasignar_pendientes($conexion, 'horario:' . $cfg['hora'], $enviarSincrono, null, $carreraCfg);
            $conexion->query("UPDATE recordatorios_log SET id_config = {$idCfg} WHERE id_log = LAST_INSERT_ID()");
            $resultados[] = $r;
        } elseif ($accion === 'informe') {
            $r = rec_generar_informe($conexion, true, 'horario:' . $cfg['hora'], null, $carreraCfg);
            $conexion->query("UPDATE recordatorios_log SET id_config = {$idCfg} WHERE id_log = LAST_INSERT_ID()");
            $resultados[] = $r;
        } else {
            $resultados[] = rec_ejecutar_recordatorio($conexion, [
                'id_config' => $idCfg,
                'hora' => $cfg['hora'],
                'asunto' => $cfg['asunto'],
                'mensaje_personalizado' => $cfg['mensaje_personalizado'],
                'ejecutado_por' => 'horario:' . $cfg['hora'],
                'sincrono' => $enviarSincrono,
                'carrera' => $carreraCfg,
            ]);
        }
    }

    return $resultados;
}
?>
