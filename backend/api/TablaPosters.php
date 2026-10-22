<?php
// backend/api/TablaPosters.php — listado de pósters (con apoyo a rondas).
//
// GET: parámetros opcionales
//   id_usuario        pósters de un autor
//   id_evaluador      pósters asignados a un evaluador (ronda 1) o seleccionados
//                     para su ronda (ronda 2 en adelante)
//   id_ronda | ronda  contexto de ronda: agrega promedio, estado, selección...
//   orden             fecha (por defecto) | promedio_desc | promedio_asc |
//                     nota_desc | nota_asc
//                     `promedio_*` ordena por el promedio de la ronda indicada; si
//                     no hay ronda, cae al promedio general del póster.
//                     `nota_*` ordena siempre por el promedio general (todas las rondas).
//   solo_seleccionados  1 para ver únicamente los pósters seleccionados
//   nota_minima       nota mínima (0.1 - 5.0) sobre el promedio general; vacío = sin límite
//   solo_evaluados    1 para ocultar los pósters que todavía no tienen ninguna nota
//
// NOTA DE SEGURIDAD: este endpoint histórico todavía no exige token (deuda
// documentada en SEGURIDAD-CAMBIOS.txt y fuera de esta entrega). Las columnas
// `es_autor` / `calificable` que devuelve son solo informativas para la
// interfaz: la validación real está en Evaluaciones.php y Rondas.php, que sí
// exigen sesión y verifican la elegibilidad en el servidor.

require_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, PUT, DELETE, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/RondasHelper.php';
include_once __DIR__ . '/includes/PostersHelper.php';
include_once __DIR__ . '/includes/ArchivosHelper.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        traerPosters();
        break;
    case 'PUT':
        require_login();
        modificarPoster();
        break;
    case 'DELETE':
        require_login();
        eliminarPoster();
        break;
}

/**
 * Autorización de edición/borrado: dueño del póster o rol 3/4 (admin/superadmin).
 * Devuelve null si puede continuar; si no, responde 403 y termina.
 */
function pp_exigir_dueno_o_admin($idPoster)
{
    global $conexion;
    $auth = auth_current();
    if (!$auth) {
        auth_deny(401, "No autenticado.");
    }
    $rol = (int)$auth['rol'];
    if ($rol === 3 || $rol === 4) {
        return $auth;
    }
    $id = intval($idPoster);
    if ($id <= 0) {
        auth_deny(400, "ID de póster inválido.");
    }
    $stmt = $conexion->prepare("SELECT id_usuario FROM cargar_posters WHERE id = ? AND activo = 1 LIMIT 1");
    if (!$stmt) {
        auth_deny(500, "Error interno.");
    }
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) {
        auth_deny(404, "Póster no encontrado.");
    }
    if ((int)$row['id_usuario'] !== (int)$auth['id']) {
        auth_deny(403, "No puedes modificar un póster que no te pertenece.");
    }
    return $auth;
}

function traerPosters()
{
    global $conexion;
    try {
        $id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;
        $id_evaluador = isset($_GET['id_evaluador']) ? intval($_GET['id_evaluador']) : null;
        $id_poster_exacto = isset($_GET['id']) ? intval($_GET['id']) : 0;
        $id_ronda = 0;
        if (isset($_GET['id_ronda'])) $id_ronda = intval($_GET['id_ronda']);
        if (isset($_GET['ronda'])) $id_ronda = intval($_GET['ronda']);
        $orden = isset($_GET['orden']) ? trim((string)$_GET['orden']) : 'fecha';
        $soloSeleccionados = isset($_GET['solo_seleccionados']) && $_GET['solo_seleccionados'] !== '' && intval($_GET['solo_seleccionados']) === 1;
        $soloEvaluados = isset($_GET['solo_evaluados']) && intval($_GET['solo_evaluados']) === 1;

        // Nota mínima sobre el promedio general. Vacío o no numérico = sin límite.
        $notaMinima = null;
        if (isset($_GET['nota_minima']) && trim((string)$_GET['nota_minima']) !== '') {
            $crudo = str_replace(',', '.', trim((string)$_GET['nota_minima']));
            if (is_numeric($crudo)) {
                $notaMinima = max(0.0, min(5.0, floatval($crudo)));
            }
        }

        // Contexto de evento del administrador (rol 3) o filtro explícito (?id_evento=)
        $authCurr = auth_current();
        $id_evento_admin = auth_id_evento_admin($conexion, $authCurr);
        $id_evento_filtro = isset($_GET['id_evento']) ? intval($_GET['id_evento']) : 0;
        if ($id_evento_admin !== null && ($id_usuario === null || $id_usuario <= 0) && ($id_evaluador === null || $id_evaluador <= 0)) {
            $id_evento_filtro = $id_evento_admin;
        }

        // Contexto de ronda (si se pidió alguno).
        $ronda = null;
        if ($id_ronda > 0) {
            $ronda = rh_ronda($conexion, $id_ronda);
            if (!$ronda) rh_error(404, 'No se encontró la ronda indicada.', 'ronda_no_encontrada');
            if ($id_evento_admin !== null && ($id_usuario === null || $id_usuario <= 0) && ($id_evaluador === null || $id_evaluador <= 0)) {
                if (intval($ronda['id_evento']) !== $id_evento_admin) {
                    rh_error(403, 'Esta ronda no pertenece al evento que administras.', 'evento_no_autorizado');
                }
            }
        }

        $sql = "SELECT 
                    p.id,
                    p.id_usuario,
                    p.titulo,
                    p.autores,
                    p.descripcion,
                    p.categoria,
                    p.palabrasClave AS palabras_clave,
                    p.id_evento,
                    ev.nombre_evento,
                    ev.codigo_evento,
                    ev.carrera AS evento_carrera,
                    DATE_FORMAT(ev.fecha_inicio, '%d/%m/%Y') AS evento_fecha_inicio,
                    DATE_FORMAT(ev.fecha_fin, '%d/%m/%Y') AS evento_fecha_fin,
                    p.id_espacio,
                    e.nombre_espacio,
                    CASE
                        WHEN p.id_espacio IS NOT NULL THEN (
                            SELECT COUNT(*) FROM cargar_posters p2 
                            WHERE p2.id_espacio = p.id_espacio AND p2.id <= p.id AND p2.activo = 1
                        )
                        ELSE NULL
                    END AS ubicacion_detallada,
                    -- Contrato único: devolver SOLO la clave del archivo.
                    -- La URL pública la arma el frontend (urlArchivo / FILES_BASE).
                    CASE
                        WHEN p.ruta_imagen IS NULL OR p.ruta_imagen = '' THEN NULL
                        WHEN p.ruta_imagen LIKE 'http%' THEN SUBSTRING_INDEX(p.ruta_imagen, '/', -1)
                        ELSE SUBSTRING_INDEX(p.ruta_imagen, '/', -1)
                    END AS imagen,
                    DATE_FORMAT(p.fecha_registro, '%d/%m/%Y %H:%i') AS fecha_registro,
                    CONCAT(u.nombres, ' ', u.apellidos) AS nombre_usuario,
                    COALESCE(prof.profesores_resumen, '') AS profesores_resumen
                FROM cargar_posters p
                LEFT JOIN usuario u ON p.id_usuario = u.id
                LEFT JOIN eventos ev ON p.id_evento = ev.id_evento
                LEFT JOIN espacios_fisicos e ON p.id_espacio = e.id_espacio
                LEFT JOIN (
                    SELECT pp.id_poster,
                           GROUP_CONCAT(
                               CONCAT(up.nombres, ' ', up.apellidos,
                                      IF(pp.materia <> '', CONCAT(' (', pp.materia, ')'), ''))
                               ORDER BY pp.id ASC SEPARATOR ', '
                           ) AS profesores_resumen
                    FROM poster_profesores pp
                    INNER JOIN usuario up ON pp.id_usuario = up.id
                    GROUP BY pp.id_poster
                ) prof ON prof.id_poster = p.id";

        $condiciones = [];
        $tipos = "";
        $params = [];

        // Vista del evaluador: en CUALQUIER ronda se listan los pósters
        // asignados a él en ESA ronda. La reasignación aleatoria de la ronda 2
        // también escribe en `asignaciones_evaluadores`, así que ya no hace
        // falta un INNER JOIN a `selecciones` para las rondas >= 2 (ese join
        // ocultaba los pósters al autor y al admin: regresión de la Fase 1).
        if ($id_evaluador !== null && $id_evaluador > 0) {
            $sql .= " INNER JOIN asignaciones_evaluadores ae ON p.id = ae.id_poster";
            if ($ronda) {
                $sql .= " AND ae.id_ronda = ?";
                $tipos .= "i";
                $params[] = intval($ronda['id_ronda']);
            }
            $condiciones[] = "ae.id_evaluador = ?";
            $tipos .= "i";
            $params[] = $id_evaluador;
        }

        $condiciones[] = "p.activo = 1";

        // Búsqueda por id exacto (usado por la ruta estable /poster/:id de los QR)
        if ($id_poster_exacto > 0) {
            $condiciones[] = "p.id = ?";
            $tipos .= "i";
            $params[] = $id_poster_exacto;
        }

        // Con ronda activa o filtro por evento (Admin de evento / filtro Super Admin)
        $idEvEfectivo = $ronda ? intval($ronda['id_evento']) : $id_evento_filtro;
        if ($idEvEfectivo > 0) {
            $condiciones[] = "(p.id_evento = ? OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = ?))";
            $tipos .= "ii";
            $params[] = $idEvEfectivo;
            $params[] = $idEvEfectivo;
        }

        if ($id_usuario !== null && $id_usuario > 0) {
            $condiciones[] = "p.id_usuario = ?";
            $tipos .= "i";
            $params[] = $id_usuario;
        }

        $sql .= " WHERE " . implode(" AND ", $condiciones);
        $sql .= " ORDER BY p.fecha_registro DESC";

        $stmt = $conexion->prepare($sql);
        if (!$stmt) throw new Exception('Error al preparar la consulta');
        if ($tipos !== "") {
            $stmt->bind_param($tipos, ...$params);
        }
        $stmt->execute();
        $resultado = $stmt->get_result();

        $posters = [];
        $idsPosters = [];
        while ($row = $resultado->fetch_assoc()) {
            $row['id'] = intval($row['id']);
            $row['id_usuario'] = intval($row['id_usuario']);
            $posters[$row['id']] = $row;
            $idsPosters[] = $row['id'];
        }
        $stmt->close();

        // Profesores y materias estructurados por póster (Fase 2.4)
        $profesoresMapa = ph_profesores_por_posters($conexion, $idsPosters);

        // Promedio general del póster: todas sus notas, de todas las rondas.
        // Es lo que permite ordenar y filtrar por nota cuando NO hay ronda
        // seleccionada (`promedio_ronda` es null en ese caso).
        $promedioGeneral = []; // [id_poster] = ['promedio' => float, 'n_evaluaciones' => int]
        if (count($idsPosters) > 0) {
            $marcas = implode(',', array_fill(0, count($idsPosters), '?'));
            $sqlGen = "SELECT nota.id_poster,
                              ROUND(AVG(nota.nota_eval), 2) AS promedio,
                              COUNT(nota.nota_eval) AS n_evaluaciones
                       FROM (
                           SELECT d.id_poster, d.id_evaluador,
                                  ROUND(AVG(d.calificacion), 2) AS nota_eval
                           FROM evaluaciones_detalles d
                           WHERE d.calificacion > 0 AND d.id_poster IN ({$marcas})
                           GROUP BY d.id_poster, d.id_evaluador
                       ) nota
                       GROUP BY nota.id_poster";
            $stmtGen = $conexion->prepare($sqlGen);
            if ($stmtGen) {
                $stmtGen->bind_param(str_repeat('i', count($idsPosters)), ...$idsPosters);
                $stmtGen->execute();
                $resGen = $stmtGen->get_result();
                while ($filaGen = $resGen->fetch_assoc()) {
                    $promedioGeneral[intval($filaGen['id_poster'])] = [
                        'promedio' => $filaGen['promedio'] === null ? null : round(floatval($filaGen['promedio']), 2),
                        'n_evaluaciones' => intval($filaGen['n_evaluaciones']),
                    ];
                }
                $stmtGen->close();
            } else {
                rh_log('TablaPosters GET: error al preparar el promedio general: ' . $conexion->error);
            }
        }

        // Estadísticas de la ronda (promedio, evaluaciones, selección, lugar...).
        $estadisticas = [];
        if ($ronda) {
            $id_ronda_sel = intval($ronda['id_ronda']);
            if (intval($ronda['numero']) <= 1) {
                // Para la ronda 1, la selección vive en la ronda siguiente.
                // (Directo por evento+número: evita releer la ronda actual.)
                $siguiente = rh_ronda_por_numero($conexion, $ronda['id_evento'], intval($ronda['numero']) + 1);
                if ($siguiente) $id_ronda_sel = intval($siguiente['id_ronda']);
            }
            $filas = rh_estadisticas_ronda($conexion, $ronda, $id_ronda_sel, false);
            foreach ($filas as $fila) {
                $estadisticas[$fila['id_poster']] = $fila;
            }
        }

        // Con `todas_las_rondas=1` cada póster lleva su detalle en cada ronda
        // de todos los eventos en los que participa (para la vista del autor).
        $todasLasRondas = isset($_GET['todas_las_rondas']) && intval($_GET['todas_las_rondas']) === 1;
        $detalleRondas = []; // [id_poster][id_ronda] = fila
        if ($todasLasRondas && count($idsPosters) > 0) {
            $eventos = [];
            foreach ($posters as $row) {
                if (!empty($row['id_evento'])) {
                    $eventos[intval($row['id_evento'])] = true;
                }
            }
            $marcasPE = implode(',', array_fill(0, count($idsPosters), '?'));
            $stmtPE = $conexion->prepare("SELECT DISTINCT id_evento FROM poster_eventos WHERE id_poster IN ({$marcasPE})");
            if ($stmtPE) {
                $stmtPE->bind_param(str_repeat('i', count($idsPosters)), ...$idsPosters);
                $stmtPE->execute();
                $resPE = $stmtPE->get_result();
                while ($rowPE = $resPE->fetch_assoc()) {
                    if (!empty($rowPE['id_evento'])) {
                        $eventos[intval($rowPE['id_evento'])] = true;
                    }
                }
                $stmtPE->close();
            }
            foreach (array_keys($eventos) as $id_evento) {
                $sqlR = "SELECT r.*, ev.nombre_evento, ev.codigo_evento FROM rondas r JOIN eventos ev ON ev.id_evento = r.id_evento WHERE r.id_evento = ? ORDER BY r.numero ASC";
                $stmtR = $conexion->prepare($sqlR);
                $stmtR->bind_param("i", $id_evento);
                $stmtR->execute();
                $resR = $stmtR->get_result();
                $rondasEvento = [];
                while ($filaR = $resR->fetch_assoc()) {
                    $rondasEvento[] = $filaR;
                }
                $stmtR->close();

                foreach ($rondasEvento as $rondaEvento) {
                    $id_sel = intval($rondaEvento['id_ronda']);
                    if (intval($rondaEvento['numero']) <= 1) {
                        $siguiente = rh_ronda_por_numero($conexion, $rondaEvento['id_evento'], intval($rondaEvento['numero']) + 1);
                        if ($siguiente) $id_sel = intval($siguiente['id_ronda']);
                    }
                    foreach (rh_estadisticas_ronda($conexion, $rondaEvento, $id_sel, false) as $fila) {
                        $detalleRondas[$fila['id_poster']][intval($rondaEvento['id_ronda'])] = array_merge($fila, [
                            'id_ronda' => intval($rondaEvento['id_ronda']),
                            'id_evento' => intval($rondaEvento['id_evento']),
                            'nombre_evento' => $rondaEvento['nombre_evento'] ?? '',
                            'codigo_evento' => $rondaEvento['codigo_evento'] ?? '',
                            'numero' => intval($rondaEvento['numero']),
                            'nombre' => $rondaEvento['nombre'],
                            'estado' => $rondaEvento['estado'],
                        ]);
                    }
                }
            }
        }

        $lista = [];

        // Elegibilidad del evaluador: SIEMPRE se calcula cuando hay id_evaluador,
        // con o sin ronda explícita (Fase 1.4). Sin ronda se resuelve la vigente
        // del servidor por evento (última abierta; si no hay, la última).
        $elegibilidadLote = [];
        if ($ronda && $id_evaluador !== null && $id_evaluador > 0) {
            $elegibilidadLote = rh_elegibilidad_lote($conexion, $id_evaluador, $ronda, $posters);
        } elseif (!$ronda && $id_evaluador !== null && $id_evaluador > 0 && count($posters) > 0) {
            $eventosIds = [];
            foreach ($posters as $rowP) {
                if (!empty($rowP['id_evento'])) $eventosIds[intval($rowP['id_evento'])] = true;
            }
            $rondaVigentePorEvento = [];
            foreach (array_keys($eventosIds) as $idEv) {
                $stmtV = $conexion->prepare("SELECT r.* FROM rondas r WHERE r.id_evento = ? ORDER BY (r.estado = 'abierta') DESC, r.numero DESC LIMIT 1");
                $stmtV->bind_param("i", $idEv);
                $stmtV->execute();
                $filaV = $stmtV->get_result()->fetch_assoc();
                $stmtV->close();
                if ($filaV) $rondaVigentePorEvento[$idEv] = $filaV;
            }
            $porRonda = [];
            foreach ($posters as $idP => $rowP) {
                $idEv = intval($rowP['id_evento'] ?? 0);
                $rv = $rondaVigentePorEvento[$idEv] ?? null;
                if ($rv) $porRonda[intval($rv['id_ronda'])]['ronda'] = $rv;
                if ($rv) $porRonda[intval($rv['id_ronda'])]['posters'][$idP] = $rowP;
            }
            foreach ($porRonda as $grupo) {
                $lote = rh_elegibilidad_lote($conexion, $id_evaluador, $grupo['ronda'], $grupo['posters']);
                foreach ($lote as $idP => $el) {
                    $elegibilidadLote[$idP] = $el;
                    $elegibilidadLote[$idP]['_ronda'] = $grupo['ronda'];
                }
            }
        }

        foreach ($posters as $id_poster => $row) {
            $stat = $estadisticas[$id_poster] ?? null;
            $infoProf = $profesoresMapa[$id_poster] ?? null;

            $row['profesores'] = $infoProf ? $infoProf['lista'] : [];
            $row['materias'] = $infoProf ? $infoProf['materias'] : [];
            $row['profesores_resumen'] = $infoProf ? $infoProf['resumen'] : ($row['profesores_resumen'] ?? '');

            $row['id_ronda'] = $ronda ? intval($ronda['id_ronda']) : null;
            $row['nombre_ronda'] = $ronda ? $ronda['nombre'] : null;
            $row['ronda_cerrada'] = $ronda ? ($ronda['estado'] !== 'abierta') : false;
            $row['promedio_ronda'] = $stat ? $stat['promedio'] : null;
            $row['n_evaluaciones_ronda'] = $stat ? $stat['n_evaluaciones'] : 0;
            $row['evaluadores_ronda'] = $stat ? $stat['n_asignados'] : 0;
            $row['pendientes_ronda'] = $stat ? $stat['pendientes'] : 0;
            $row['estado_evaluacion'] = $stat ? $stat['estado_evaluacion'] : 'Sin evaluar';
            $row['seleccionado'] = $stat ? $stat['seleccionado'] : false;
            $row['seleccion_manual'] = $stat ? $stat['seleccion_manual'] : false;
            $row['lugar'] = $stat ? $stat['lugar'] : null;
            $row['premio'] = $stat ? $stat['premio'] : null;

            // Promedio sobre TODAS las rondas: el filtro de nota funciona
            // aunque no haya ninguna ronda seleccionada.
            $gen = $promedioGeneral[$id_poster] ?? null;
            $row['promedio_general'] = $gen ? $gen['promedio'] : null;
            $row['n_evaluaciones_general'] = $gen ? $gen['n_evaluaciones'] : 0;

            // Detalle por cada ronda del evento (opcional).
            $row['rondas'] = [];
            if ($todasLasRondas && isset($detalleRondas[$id_poster])) {
                foreach ($detalleRondas[$id_poster] as $filaRonda) {
                    $row['rondas'][] = [
                        'id_ronda' => $filaRonda['id_ronda'],
                        'id_evento' => $filaRonda['id_evento'] ?? null,
                        'nombre_evento' => $filaRonda['nombre_evento'] ?? '',
                        'codigo_evento' => $filaRonda['codigo_evento'] ?? '',
                        'numero' => $filaRonda['numero'],
                        'nombre' => $filaRonda['nombre'],
                        'estado' => $filaRonda['estado'],
                        'promedio' => $filaRonda['promedio'],
                        'n_evaluaciones' => $filaRonda['n_evaluaciones'],
                        'n_asignados' => $filaRonda['n_asignados'],
                        'estado_evaluacion' => $filaRonda['estado_evaluacion'],
                        'seleccionado' => $filaRonda['seleccionado'],
                        'lugar' => $filaRonda['lugar'],
                        'premio' => $filaRonda['premio'],
                    ];
                }
            }

            // ¿Es el autor el propio usuario de la consulta? (solo informativo)
            $row['es_autor'] = ($id_evaluador !== null && $id_evaluador > 0 && intval($row['id_usuario']) === $id_evaluador)
                || ($id_usuario !== null && $id_usuario > 0 && intval($row['id_usuario']) === $id_usuario);

            $row['calificable'] = true;
            $row['motivo_bloqueo'] = '';
            $el = $elegibilidadLote[$id_poster] ?? null;
            if ($el !== null) {
                $row['calificable'] = $el['puede'];
                $row['motivo_bloqueo'] = $el['motivo'];
                $row['es_autor'] = $el['es_autor'];
                if (!$ronda && isset($el['_ronda'])) {
                    $row['id_ronda'] = intval($el['_ronda']['id_ronda']);
                    $row['nombre_ronda'] = $el['_ronda']['nombre'];
                    $row['ronda_cerrada'] = ($el['_ronda']['estado'] !== 'abierta');
                }
            }

            $lista[] = $row;
        }

        // Filtros y orden en función del promedio de la ronda.
        if ($soloSeleccionados) {
            $lista = array_values(array_filter($lista, function ($p) { return $p['seleccionado']; }));
        }

        // Filtros por nota (siempre sobre el promedio general, con o sin ronda).
        if ($soloEvaluados) {
            $lista = array_values(array_filter($lista, function ($p) { return $p['promedio_general'] !== null; }));
        }

        if ($notaMinima !== null) {
            $lista = array_values(array_filter($lista, function ($p) use ($notaMinima) {
                return $p['promedio_general'] !== null && floatval($p['promedio_general']) >= $notaMinima;
            }));
        }

        // Orden. `promedio_*` usa la ronda indicada y, si no hay ninguna, cae al
        // promedio general; `nota_*` siempre usa el promedio general.
        if ($orden === 'promedio_desc' || $orden === 'promedio_asc'
            || $orden === 'nota_desc' || $orden === 'nota_asc') {
            $descendente = ($orden === 'promedio_desc' || $orden === 'nota_desc');
            $usarRonda = ($orden === 'promedio_desc' || $orden === 'promedio_asc');
            $campo = ($usarRonda && $ronda) ? 'promedio_ronda' : 'promedio_general';

            usort($lista, function ($a, $b) use ($campo, $descendente) {
                $pa = $a[$campo];
                $pb = $b[$campo];
                if ($pa === null && $pb === null) return strcmp($a['titulo'], $b['titulo']);
                // Los pósters sin nota se van siempre al final.
                if ($pa === null) return 1;
                if ($pb === null) return -1;
                if (floatval($pa) == floatval($pb)) return strcmp($a['titulo'], $b['titulo']);
                if ($descendente) return floatval($pa) > floatval($pb) ? -1 : 1;
                return floatval($pa) < floatval($pb) ? -1 : 1;
            });
        } elseif ($orden === 'titulo_asc') {
            usort($lista, function ($a, $b) { return strcmp($a['titulo'], $b['titulo']); });
        }

        echo json_encode([
            'success' => true,
            'data' => array_values($lista),
            'count' => count($lista)
        ]);

    } catch (Exception $e) {
        rh_log('TablaPosters GET: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'No fue posible cargar los pósters.'
        ]);
    }
}

function modificarPoster()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        echo json_encode(["success" => false, "status" => "error", "message" => "Datos inválidos"]);
        return;
    }

    $id = intval($data['id'] ?? 0);
    $titulo = trim((string)($data['titulo'] ?? ''));
    $autores = trim((string)($data['autores'] ?? ''));
    $descripcion = trim((string)($data['descripcion'] ?? ''));
    $categoria = trim((string)($data['categoria'] ?? ''));
    $palabrasClave = trim((string)($data['palabrasClave'] ?? ''));

    $forzarRaw = $data['forzar_guardado'] ?? false;
    $forzar_guardado = ($forzarRaw === true || $forzarRaw === 'true' || $forzarRaw === 1 || $forzarRaw === '1');

    if ($id <= 0 || $titulo === '') {
        echo json_encode([
            "success" => false,
            "status" => "error",
            "message" => "El ID y el título del póster son obligatorios."
        ]);
        return;
    }

    // A1: solo el dueño o admin/superadmin puede editar.
    pp_exigir_dueno_o_admin($id);

    if (mb_strlen($descripcion, 'UTF-8') > 255) {
        echo json_encode([
            "success" => false,
            "status" => "error",
            "message" => "La descripción no puede superar los 255 caracteres (actual: " . mb_strlen($descripcion, 'UTF-8') . ")."
        ]);
        return;
    }

    // Obtener el evento actual del póster para acotar el chequeo de duplicados
    $idEventoPoster = ph_evento_activo($conexion);
    $stmtEv = $conexion->prepare("SELECT id_evento FROM cargar_posters WHERE id = ? LIMIT 1");
    if ($stmtEv) {
        $stmtEv->bind_param("i", $id);
        $stmtEv->execute();
        $filaEv = $stmtEv->get_result()->fetch_assoc();
        $stmtEv->close();
        if ($filaEv && !empty($filaEv['id_evento'])) {
            $idEventoPoster = intval($filaEv['id_evento']);
        }
    }

    try {
        $conexion->begin_transaction();

        // Chequeo de duplicados difusos al editar (excluyendo el propio póster)
        if (!$forzar_guardado) {
            $chequeo = ph_detectar_duplicados($conexion, [
                'titulo' => $titulo,
                'descripcion' => $descripcion,
                'autores' => $autores,
                'palabrasClave' => $palabrasClave,
                'id_evento' => $idEventoPoster,
                'excluir_id' => $id,
                'bloquear_filas' => true,
            ]);

            if ($chequeo['hay_duplicados']) {
                $conexion->rollback();
                echo json_encode([
                    "status" => "duplicados",
                    "success" => false,
                    "message" => $chequeo['mensaje'],
                    "duplicados" => $chequeo['duplicados'],
                ]);
                return;
            }
        }

        $sql = "UPDATE cargar_posters SET titulo = ?, autores = ?, descripcion = ?, categoria = ?, palabrasClave = ? WHERE id = ?";
        $sentencia = $conexion->prepare($sql);
        if (!$sentencia) {
            throw new Exception("No se pudo preparar la actualización del póster.");
        }
        $sentencia->bind_param("sssssi", $titulo, $autores, $descripcion, $categoria, $palabrasClave, $id);
        if (!$sentencia->execute()) {
            $err = $sentencia->error;
            $sentencia->close();
            throw new Exception($err);
        }
        $sentencia->close();

        // Actualizar profesores y materias si el payload los incluye
        if (array_key_exists('profesores', $data) || array_key_exists('materias', $data) || array_key_exists('profesores_materias', $data)) {
            $pares = ph_normalizar_pares_profesores(
                $data['profesores'] ?? null,
                $data['materias'] ?? null,
                $data['profesores_materias'] ?? null
            );
            ph_guardar_profesores_poster($conexion, $id, $pares);
        }

        $conexion->commit();

        // Notificar al autor que el admin modificó su póster (tras responder)
        $destPos = null; $asuntoPos = null; $mensajePos = null;
        $sqlAut = "SELECT u.correo, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_autor FROM cargar_posters p JOIN usuario u ON p.id_usuario = u.id WHERE p.id = ?";
        $stmtAut = $conexion->prepare($sqlAut);
        $stmtAut->bind_param("i", $id);
        $stmtAut->execute();
        $resAut = $stmtAut->get_result();
        if ($rowAut = $resAut->fetch_assoc()) {
            $tituloE = rh_escapar($titulo);
            $autoresE = rh_escapar($autores);
            $descripcionE = rh_escapar($descripcion);
            $categoriaE = rh_escapar($categoria);
            $palabrasE = rh_escapar($palabrasClave);
            $destPos = $rowAut['correo'];
            $asuntoPos = "Tu póster ha sido modificado por el administrador";
            $mensajePos = "<h2>Hola, " . rh_escapar($rowAut['nombre_autor']) . "!</h2><p>Tu póster <strong>'{$tituloE}'</strong> ha sido modificado por el administrador.</p><p>Datos actualizados:<br>Título: {$tituloE}<br>Autores: {$autoresE}<br>Descripción: {$descripcionE}<br>Categoría: {$categoriaE}<br>Palabras clave: {$palabrasE}</p>";
        }
        $stmtAut->close();
        responderJsonYNotificar([
            "status" => "success",
            "success" => true,
            "message" => "Póster modificado correctamente"
        ], $destPos, $asuntoPos, $mensajePos);
        return;
    } catch (Throwable $e) {
        @$conexion->rollback();
        error_log('TablaPosters modificar: ' . $e->getMessage());
        echo json_encode([
            "status" => "error",
            "success" => false,
            "message" => "No se pudo modificar el póster."
        ]);
    }
}

function eliminarPoster()
{
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode([
            'success' => false,
            'message' => 'ID de póster inválido'
        ]);
        return;
    }

    // A1: solo el dueño o admin/superadmin puede eliminar.
    pp_exigir_dueno_o_admin($id);

    $sql = "UPDATE cargar_posters SET activo = 0 WHERE id = ?";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param('i', $id);

    if ($sentencia->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Póster eliminado correctamente'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al eliminar póster'
        ]);
    }
}
?>
