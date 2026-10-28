<?php
// backend/api/includes/PostersHelper.php
// Lógica compartida de la Fase 2:
//   - Normalización y detección de duplicados difusos (título, descripción,
//     hash_archivo SHA-256 y señales secundarias de autores/palabras clave).
//   - Gestión de profesores y materias por póster (`poster_profesores`).
//   - Asignación aleatoria automática de evaluadores al subir un póster.

include_once __DIR__ . '/RondasHelper.php';

/**
 * Normaliza una cadena de carrera a 'sistemas', 'civil' o 'ambas'.
 */
function ph_normalizar_carrera($carrera)
{
    $c = mb_strtolower(trim((string)$carrera), 'UTF-8');
    if ($c === 'ambas' || str_contains($c, 'ambas')) return 'ambas';
    if ($c === 'civil' || str_contains($c, 'civil')) return 'civil';
    return 'sistemas';
}

/**
 * Etiqueta legible de carrera para UI y correos.
 */
function ph_etiqueta_carrera($carrera)
{
    $norm = ph_normalizar_carrera($carrera);
    if ($norm === 'civil') return 'Ingeniería Civil';
    if ($norm === 'ambas') return 'Ingeniería de Sistemas e Ingeniería Civil';
    return 'Ingeniería de Sistemas';
}

/**
 * Resuelve el id_evento activo (opcionalmente filtrado por carrera: 'sistemas' o 'civil').
 */
function ph_evento_activo($conexion, $carrera = null)
{
    if ($carrera !== null && trim((string)$carrera) !== '') {
        $cNorm = ph_normalizar_carrera($carrera);
        if ($cNorm === 'sistemas' || $cNorm === 'civil') {
            $stmt = $conexion->prepare(
                "SELECT id_evento FROM eventos WHERE activo = 1 AND (carrera = ? OR carrera = 'ambas') ORDER BY (carrera = ?) DESC, id_evento ASC LIMIT 1"
            );
            if ($stmt) {
                $stmt->bind_param("ss", $cNorm, $cNorm);
                $stmt->execute();
                $res = $stmt->get_result();
                if ($res && ($fila = $res->fetch_assoc())) {
                    $stmt->close();
                    return intval($fila['id_evento']);
                }
                $stmt->close();
            }
        }
    }
    $res = $conexion->query("SELECT id_evento FROM eventos WHERE activo = 1 ORDER BY id_evento ASC LIMIT 1");
    if ($res && ($fila = $res->fetch_assoc())) {
        return intval($fila['id_evento']);
    }
    $res2 = $conexion->query("SELECT id_evento FROM eventos ORDER BY id_evento ASC LIMIT 1");
    if ($res2 && ($fila2 = $res2->fetch_assoc())) {
        return intval($fila2['id_evento']);
    }
    return 1;
}

/**
 * Devuelve los ids de eventos activos que corresponden a la carrera elegida ('sistemas', 'civil', 'ambas').
 */
function ph_eventos_activos_para_carrera($conexion, $carreraParticipacion)
{
    $cNorm = ph_normalizar_carrera($carreraParticipacion);
    $ids = [];
    if ($cNorm === 'ambas') {
        $idSis = ph_evento_activo($conexion, 'sistemas');
        $idCiv = ph_evento_activo($conexion, 'civil');
        if ($idSis > 0) $ids[] = $idSis;
        if ($idCiv > 0 && !in_array($idCiv, $ids, true)) $ids[] = $idCiv;
    } else {
        $idEv = ph_evento_activo($conexion, $cNorm);
        if ($idEv > 0) $ids[] = $idEv;
    }
    if (empty($ids)) {
        $ids[] = ph_evento_activo($conexion);
    }
    return array_values(array_unique(array_map('intval', $ids)));
}

/**
 * Asegura la tabla puente `poster_eventos` y sincroniza los eventos asociados a un póster.
 */
function ph_sincronizar_poster_eventos($conexion, $id_poster, array $ids_eventos)
{
    $id_poster = intval($id_poster);
    if ($id_poster <= 0) return;

    $conexion->query("CREATE TABLE IF NOT EXISTS `poster_eventos` (
        `id_poster` int(11) NOT NULL,
        `id_evento` int(11) NOT NULL,
        `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id_poster`, `id_evento`),
        KEY `idx_poster_eventos_evento` (`id_evento`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $idsLimpios = array_values(array_unique(array_filter(array_map('intval', $ids_eventos), function ($v) {
        return $v > 0;
    })));
    if (empty($idsLimpios)) return;

    $stmtDel = $conexion->prepare("DELETE FROM poster_eventos WHERE id_poster = ?");
    if ($stmtDel) {
        $stmtDel->bind_param("i", $id_poster);
        $stmtDel->execute();
        $stmtDel->close();
    }

    $stmtIns = $conexion->prepare("INSERT IGNORE INTO poster_eventos (id_poster, id_evento) VALUES (?, ?)");
    if ($stmtIns) {
        foreach ($idsLimpios as $idEv) {
            $stmtIns->bind_param("ii", $id_poster, $idEv);
            $stmtIns->execute();
        }
        $stmtIns->close();
    }
}

/**
 * Normaliza un texto para comparación difusa:
 * minúsculas UTF-8, sin tildes/diacríticos, sin signos de puntuación y con
 * espacios colapsados.
 */
function ph_normalizar_texto($texto)
{
    $s = mb_strtolower(trim((string)$texto), 'UTF-8');
    if ($s === '') return '';

    $mapaAcentos = [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a',
        'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
        'ñ' => 'n', 'ç' => 'c',
    ];
    $s = strtr($s, $mapaAcentos);
    $s = preg_replace('/[^a-z0-9\s]+/u', ' ', $s);
    $s = preg_replace('/\s+/', ' ', trim($s));
    return $s;
}

/**
 * Calcula el porcentaje de similitud (0.0 a 100.0) entre dos textos
 * combinando similar_text y distancia de Levenshtein sobre texto normalizado.
 */
function ph_porcentaje_similitud($textoA, $textoB)
{
    $a = ph_normalizar_texto($textoA);
    $b = ph_normalizar_texto($textoB);

    if ($a === '' || $b === '') return 0.0;
    if ($a === $b) return 100.0;

    $pctSimilar = 0.0;
    similar_text($a, $b, $pctSimilar);

    $pctLev = 0.0;
    $lenA = strlen($a);
    $lenB = strlen($b);
    if ($lenA <= 250 && $lenB <= 250) {
        $maxLen = max($lenA, $lenB);
        if ($maxLen > 0) {
            $dist = levenshtein($a, $b);
            if ($dist >= 0) {
                $pctLev = (1.0 - ($dist / $maxLen)) * 100.0;
            }
        }
    }

    return round(max($pctSimilar, $pctLev), 1);
}

/**
 * Detecta pósters duplicados o muy parecidos dentro del mismo evento.
 *
 * Opciones en $datos:
 *   - titulo (string)
 *   - descripcion (string)
 *   - autores (string)
 *   - palabrasClave (string)
 *   - hash_archivo (string|null)
 *   - id_evento (int)
 *   - excluir_id (int, opcional, para edición)
 *   - bloquear_filas (bool, opcional, añade FOR UPDATE si hay transacción)
 */
function ph_detectar_duplicados($conexion, array $datos)
{
    $titulo = trim((string)($datos['titulo'] ?? ''));
    $descripcion = trim((string)($datos['descripcion'] ?? ''));
    $autores = trim((string)($datos['autores'] ?? ''));
    $palabrasClave = trim((string)($datos['palabrasClave'] ?? ''));
    $hashArchivo = isset($datos['hash_archivo']) && $datos['hash_archivo'] !== ''
        ? strtolower(trim((string)$datos['hash_archivo']))
        : null;
    $idEvento = intval($datos['id_evento'] ?? 0);
    if ($idEvento <= 0) {
        $idEvento = ph_evento_activo($conexion);
    }
    $excluirId = intval($datos['excluir_id'] ?? 0);
    $forUpdate = !empty($datos['bloquear_filas']) ? ' FOR UPDATE' : '';

    $sql = "SELECT p.id, p.titulo, p.autores, p.descripcion, p.categoria,
                   p.palabrasClave, p.hash_archivo, p.id_usuario, p.id_evento,
                   CONCAT(u.nombres, ' ', u.apellidos) AS nombre_usuario
            FROM cargar_posters p
            LEFT JOIN usuario u ON p.id_usuario = u.id
            WHERE p.activo = 1
              AND (p.id_evento = ? OR p.id_evento IS NULL)
              AND p.id <> ?{$forUpdate}";

    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        return ['hay_duplicados' => false, 'mensaje' => '', 'duplicados' => []];
    }
    $stmt->bind_param("ii", $idEvento, $excluirId);
    $stmt->execute();
    $res = $stmt->get_result();

    $normTitulo = ph_normalizar_texto($titulo);
    $normDesc = ph_normalizar_texto($descripcion);
    $lenDesc = mb_strlen($normDesc, 'UTF-8');

    $duplicados = [];
    $huboTitulo = false;
    $huboDesc = false;
    $huboArchivo = false;

    while ($fila = $res->fetch_assoc()) {
        $motivos = [];
        $maxPct = 0.0;

        // 1) Archivo idéntico por SHA-256
        $hashFila = !empty($fila['hash_archivo']) ? strtolower(trim((string)$fila['hash_archivo'])) : '';
        if ($hashArchivo && $hashFila !== '' && hash_equals($hashFila, $hashArchivo)) {
            $motivos[] = 'Archivo idéntico (100 %)';
            $maxPct = max($maxPct, 100.0);
            $huboArchivo = true;
        }

        // 2) Similitud de título (umbral >= 80 %, cubre el >= 85 % y variaciones leves)
        $pctTitulo = ph_porcentaje_similitud($titulo, $fila['titulo'] ?? '');
        if ($normTitulo !== '' && $pctTitulo >= 80.0) {
            $motivos[] = ($pctTitulo >= 99.5)
                ? 'Título idéntico (100 %)'
                : "Título muy parecido ({$pctTitulo} %)";
            $maxPct = max($maxPct, $pctTitulo);
            $huboTitulo = true;
        }

        // 3) Similitud de descripción (evita falsos positivos en textos muy cortos)
        $normDescFila = ph_normalizar_texto($fila['descripcion'] ?? '');
        $lenDescFila = mb_strlen($normDescFila, 'UTF-8');
        $pctDesc = 0.0;
        if ($normDesc !== '' && $normDescFila !== '') {
            $ambasSuficientes = ($lenDesc >= 20 && $lenDescFila >= 20);
            $exactaCorta = ($normDesc === $normDescFila && $lenDesc >= 10);
            if ($ambasSuficientes || $exactaCorta) {
                $pctDesc = ph_porcentaje_similitud($descripcion, $fila['descripcion'] ?? '');
                if ($pctDesc >= 85.0) {
                    $motivos[] = ($pctDesc >= 99.5)
                        ? 'Descripción idéntica (100 %)'
                        : "Descripción muy parecida ({$pctDesc} %)";
                    $maxPct = max($maxPct, $pctDesc);
                    $huboDesc = true;
                }
            }
        }

        // 4) Señal secundaria: autores y palabras clave
        $pctAutores = ph_porcentaje_similitud($autores, $fila['autores'] ?? '');
        $pctPalabras = ph_porcentaje_similitud($palabrasClave, $fila['palabrasClave'] ?? '');

        if (empty($motivos) && $pctTitulo >= 68.0 && ($pctAutores >= 80.0 || $pctPalabras >= 80.0)) {
            $comb = round(($pctTitulo + max($pctAutores, $pctPalabras)) / 2, 1);
            $motivos[] = "Título similar ({$pctTitulo} %) con mismos autores/palabras clave";
            $maxPct = max($maxPct, $comb);
            $huboTitulo = true;
        } elseif (!empty($motivos)) {
            $secundarias = [];
            if ($pctAutores >= 75.0) $secundarias[] = "autores ({$pctAutores} %)";
            if ($pctPalabras >= 75.0) $secundarias[] = "palabras clave ({$pctPalabras} %)";
            if (!empty($secundarias)) {
                $motivos[] = 'Coincidencia en ' . implode(' y ', $secundarias);
            }
        }

        if (!empty($motivos)) {
            $autorMostrar = trim((string)($fila['autores'] ?? ''));
            if ($autorMostrar === '') {
                $autorMostrar = trim((string)($fila['nombre_usuario'] ?? 'Autor registrado'));
            }
            $duplicados[] = [
                'id' => intval($fila['id']),
                'titulo' => $fila['titulo'],
                'autor' => $autorMostrar,
                'autores' => $fila['autores'],
                'descripcion' => $fila['descripcion'],
                'categoria' => $fila['categoria'],
                'porcentaje' => round($maxPct, 1),
                'motivo' => implode(' · ', $motivos),
            ];
        }
    }
    $stmt->close();

    if (empty($duplicados)) {
        return ['hay_duplicados' => false, 'mensaje' => '', 'duplicados' => []];
    }

    usort($duplicados, function ($a, $b) {
        return $b['porcentaje'] <=> $a['porcentaje'];
    });

    $partes = [];
    if ($huboTitulo) $partes[] = 'título parecido';
    if ($huboDesc) $partes[] = 'descripción parecida';
    if ($huboArchivo) $partes[] = 'el mismo archivo';
    $resumenMotivo = !empty($partes) ? implode(', ', $partes) : 'datos similares';

    $mensaje = "Se encontraron pósters registrados en este evento con {$resumenMotivo}. Revisa las coincidencias antes de continuar.";

    return [
        'hay_duplicados' => true,
        'mensaje' => $mensaje,
        'duplicados' => $duplicados,
    ];
}

/**
 * Normaliza las entradas de profesores y materias (soporta arrays paralelos
 * profesores[] / materias[] o lista JSON/array de objetos {id_usuario, materia}).
 *
 * Devuelve [['id_usuario' => int, 'materia' => string], ...] sin duplicados.
 */
function ph_normalizar_pares_profesores($profesoresRaw = null, $materiasRaw = null, $paresRaw = null)
{
    $pares = [];

    if (is_string($paresRaw) && trim($paresRaw) !== '') {
        $dec = json_decode($paresRaw, true);
        if (is_array($dec)) $paresRaw = $dec;
    }

    if (is_array($paresRaw) && count($paresRaw) > 0) {
        foreach ($paresRaw as $item) {
            if (!is_array($item)) continue;
            $idU = intval($item['id_usuario'] ?? $item['id_profesor'] ?? $item['id'] ?? 0);
            $mat = trim((string)($item['materia'] ?? ''));
            if ($idU > 0) {
                $pares[] = ['id_usuario' => $idU, 'materia' => mb_substr($mat, 0, 160, 'UTF-8')];
            }
        }
    }

    if (empty($pares)) {
        if (is_string($profesoresRaw) && trim($profesoresRaw) !== '') {
            $decP = json_decode($profesoresRaw, true);
            $profesores = is_array($decP) ? $decP : array_map('trim', explode(',', $profesoresRaw));
        } elseif (is_array($profesoresRaw)) {
            $profesores = array_values($profesoresRaw);
        } else {
            $profesores = [];
        }

        if (is_string($materiasRaw) && trim($materiasRaw) !== '') {
            $decM = json_decode($materiasRaw, true);
            $materias = is_array($decM) ? $decM : array_map('trim', explode(',', $materiasRaw));
        } elseif (is_array($materiasRaw)) {
            $materias = array_values($materiasRaw);
        } else {
            $materias = [];
        }

        $nProf = count($profesores);
        $nMat = count($materias);

        if ($nProf === 1 && $nMat > 1) {
            $idU = intval($profesores[0]);
            if ($idU > 0) {
                foreach ($materias as $m) {
                    $mat = mb_substr(trim((string)$m), 0, 160, 'UTF-8');
                    $pares[] = ['id_usuario' => $idU, 'materia' => $mat];
                }
            }
        } else {
            for ($i = 0; $i < $nProf; $i++) {
                $idU = intval($profesores[$i]);
                if ($idU <= 0) continue;
                $mat = '';
                if (isset($materias[$i])) {
                    $mat = trim((string)$materias[$i]);
                } elseif ($nMat === 1 && isset($materias[0])) {
                    $mat = trim((string)$materias[0]);
                }
                $pares[] = [
                    'id_usuario' => $idU,
                    'materia' => mb_substr($mat, 0, 160, 'UTF-8'),
                ];
            }
        }
    }

    // Deduplicar por (id_usuario, materia en minúsculas)
    $unicos = [];
    $vistos = [];
    foreach ($pares as $p) {
        $clave = $p['id_usuario'] . '|' . mb_strtolower($p['materia'], 'UTF-8');
        if (isset($vistos[$clave])) continue;
        $vistos[$clave] = true;
        $unicos[] = $p;
    }

    return $unicos;
}

/**
 * Persiste los pares (id_usuario, materia) de un póster en `poster_profesores`.
 */
function ph_guardar_profesores_poster($conexion, $id_poster, array $pares)
{
    $id_poster = intval($id_poster);
    if ($id_poster <= 0) return [];

    $stmtDel = $conexion->prepare("DELETE FROM poster_profesores WHERE id_poster = ?");
    if ($stmtDel) {
        $stmtDel->bind_param("i", $id_poster);
        $stmtDel->execute();
        $stmtDel->close();
    }

    if (empty($pares)) return [];

    $stmtCheck = $conexion->prepare("SELECT id FROM usuario WHERE id = ? AND activo = 1 AND desactivado = 0 LIMIT 1");
    $stmtIns = $conexion->prepare("INSERT IGNORE INTO poster_profesores (id_poster, id_usuario, materia) VALUES (?, ?, ?)");
    if (!$stmtIns) {
        if ($stmtCheck) $stmtCheck->close();
        throw new Exception('No se pudo preparar el guardado de profesores del póster.');
    }

    $guardados = [];
    foreach ($pares as $par) {
        $idU = intval($par['id_usuario'] ?? 0);
        $materia = trim((string)($par['materia'] ?? ''));
        if ($idU <= 0) continue;

        if ($stmtCheck) {
            $stmtCheck->bind_param("i", $idU);
            $stmtCheck->execute();
            $existe = (bool)$stmtCheck->get_result()->fetch_row();
            if (!$existe) continue;
        }

        $stmtIns->bind_param("iis", $id_poster, $idU, $materia);
        if (!$stmtIns->execute()) {
            $stmtIns->close();
            if ($stmtCheck) $stmtCheck->close();
            throw new Exception('Error al guardar profesor asignado al póster.');
        }
        $guardados[] = ['id_usuario' => $idU, 'materia' => $materia];
    }

    $stmtIns->close();
    if ($stmtCheck) $stmtCheck->close();
    return $guardados;
}

/**
 * Devuelve el mapa [id_poster => ['lista' => [...], 'resumen' => string]]
 * para un lote de pósters.
 */
function ph_profesores_por_posters($conexion, array $idsPosters)
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $idsPosters), function ($v) {
        return $v > 0;
    })));
    $mapa = [];
    if (empty($ids)) return $mapa;

    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $sql = "SELECT pp.id, pp.id_poster, pp.id_usuario, pp.materia,
                   u.nombres, u.apellidos,
                   CONCAT(u.nombres, ' ', u.apellidos) AS nombre_profesor,
                   u.carrera, u.correo
            FROM poster_profesores pp
            INNER JOIN usuario u ON pp.id_usuario = u.id
            WHERE pp.id_poster IN ({$marcas})
            ORDER BY pp.id ASC";

    $stmt = $conexion->prepare($sql);
    if (!$stmt) return $mapa;
    $stmt->bind_param(str_repeat('i', count($ids)), ...$ids);
    $stmt->execute();
    $res = $stmt->get_result();

    while ($fila = $res->fetch_assoc()) {
        $idP = intval($fila['id_poster']);
        if (!isset($mapa[$idP])) {
            $mapa[$idP] = ['lista' => [], 'materias' => [], 'resumenPartes' => []];
        }
        $item = [
            'id' => intval($fila['id']),
            'id_usuario' => intval($fila['id_usuario']),
            'nombre_profesor' => $fila['nombre_profesor'],
            'nombres' => $fila['nombres'],
            'apellidos' => $fila['apellidos'],
            'carrera' => $fila['carrera'],
            'materia' => $fila['materia'] ?? '',
        ];
        $mapa[$idP]['lista'][] = $item;
        if (!empty($fila['materia']) && !in_array($fila['materia'], $mapa[$idP]['materias'], true)) {
            $mapa[$idP]['materias'][] = $fila['materia'];
        }
        $etiqueta = $fila['nombre_profesor'];
        if (!empty($fila['materia'])) {
            $etiqueta .= ' (' . $fila['materia'] . ')';
        }
        $mapa[$idP]['resumenPartes'][] = $etiqueta;
    }
    $stmt->close();

    foreach ($mapa as $idP => $info) {
        $mapa[$idP]['resumen'] = implode(', ', $info['resumenPartes']);
        unset($mapa[$idP]['resumenPartes']);
    }

    return $mapa;
}

/**
 * Lista de profesores disponibles para el selector del formulario de pósters.
 * Incluye usuarios activos con carrera (roles 1 y 2; y si se pide, también 3 y 4).
 */
function ph_obtener_profesores_disponibles($conexion)
{
    $sql = "SELECT u.id, u.nombres, u.apellidos,
                   CONCAT(u.nombres, ' ', u.apellidos) AS nombre_completo,
                   u.carrera, u.id_rol, r.nombre_rol
            FROM usuario u
            INNER JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.activo = 1 AND u.desactivado = 0
              AND u.id_rol IN (1, 2)
            ORDER BY u.nombres ASC, u.apellidos ASC";
    $res = $conexion->query($sql);
    $profesores = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $row['id'] = intval($row['id']);
            $row['id_rol'] = intval($row['id_rol']);
            $profesores[] = $row;
        }
    }

    if (empty($profesores)) {
        $sqlTodos = "SELECT u.id, u.nombres, u.apellidos,
                            CONCAT(u.nombres, ' ', u.apellidos) AS nombre_completo,
                            u.carrera, u.id_rol, r.nombre_rol
                     FROM usuario u
                     INNER JOIN roles r ON u.id_rol = r.id_rol
                     WHERE u.activo = 1 AND u.desactivado = 0
                     ORDER BY u.nombres ASC, u.apellidos ASC";
        $resTodos = $conexion->query($sqlTodos);
        if ($resTodos) {
            while ($row = $resTodos->fetch_assoc()) {
                $row['id'] = intval($row['id']);
                $row['id_rol'] = intval($row['id_rol']);
                $profesores[] = $row;
            }
        }
    }

    return $profesores;
}

/**
 * Sortea y asigna automáticamente evaluadores para la Ronda 1 al subir un póster,
 * excluyendo al autor y priorizando evaluadores de la misma carrera/área.
 *
 * Devuelve ['id_ronda' => int, 'evaluadores' => [...], 'notificaciones' => [...]].
 */
function ph_asignar_evaluadores_al_subir($conexion, $id_poster, $id_evento, $id_autor, $tituloPoster, $categoria = '', array $idsProfesores = [], $id_espacio = null, $nEvaluadores = 1)
{
    $id_poster = intval($id_poster);
    $id_evento = intval($id_evento);
    $id_autor = intval($id_autor);
    $nEvaluadores = max(1, intval($nEvaluadores));

    // 1) Resolver la Ronda 1 del evento (si no existe, crearla).
    $id_ronda = 0;
    $stmtR = $conexion->prepare("SELECT id_ronda, numero FROM rondas WHERE id_evento = ? ORDER BY (numero = 1) DESC, (estado = 'abierta') DESC, numero ASC LIMIT 1");
    if ($stmtR) {
        $stmtR->bind_param("i", $id_evento);
        $stmtR->execute();
        $filaR = $stmtR->get_result()->fetch_assoc();
        $stmtR->close();
        if ($filaR) {
            $id_ronda = intval($filaR['id_ronda']);
        }
    }
    if ($id_ronda <= 0) {
        $stmtCrearR = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, premios) VALUES (?, 1, 'Ronda 1 · Exposición en mesa', 'abierta', 3)");
        if ($stmtCrearR) {
            $stmtCrearR->bind_param("i", $id_evento);
            if ($stmtCrearR->execute()) {
                $id_ronda = intval($conexion->insert_id);
            }
            $stmtCrearR->close();
        }
    }
    if ($id_ronda <= 0) {
        return ['id_ronda' => 0, 'evaluadores' => [], 'notificaciones' => []];
    }

    // 2) Determinar palabra clave de carrera desde el evento ($id_evento) para priorizar evaluadores afines.
    $carreraClave = '';
    $stmtEvCar = $conexion->prepare("SELECT carrera FROM eventos WHERE id_evento = ? LIMIT 1");
    if ($stmtEvCar) {
        $stmtEvCar->bind_param("i", $id_evento);
        $stmtEvCar->execute();
        $rowEvCar = $stmtEvCar->get_result()->fetch_assoc();
        $stmtEvCar->close();
        if ($rowEvCar && !empty($rowEvCar['carrera'])) {
            $cEvLower = mb_strtolower($rowEvCar['carrera'], 'UTF-8');
            if (strpos($cEvLower, 'civil') !== false) {
                $carreraClave = 'civil';
            } elseif (strpos($cEvLower, 'sistema') !== false) {
                $carreraClave = 'sistema';
            }
        }
    }
    if ($carreraClave === '') {
        $stmtAut = $conexion->prepare("SELECT carrera FROM usuario WHERE id = ?");
        if ($stmtAut) {
            $stmtAut->bind_param("i", $id_autor);
            $stmtAut->execute();
            $rowAut = $stmtAut->get_result()->fetch_assoc();
            $stmtAut->close();
            if ($rowAut && !empty($rowAut['carrera'])) {
                $cLower = mb_strtolower($rowAut['carrera'], 'UTF-8');
                if (strpos($cLower, 'civil') !== false) {
                    $carreraClave = 'civil';
                } elseif (strpos($cLower, 'sistema') !== false || strpos($cLower, 'software') !== false) {
                    $carreraClave = 'sistema';
                } else {
                    $carreraClave = trim($cLower);
                }
            }
        }
    }
    if ($carreraClave === '' && $categoria !== '') {
        $catLower = mb_strtolower($categoria, 'UTF-8');
        if (in_array($catLower, ['desarrolloweb', 'programacion', 'backend', 'frontend'], true)) {
            $carreraClave = 'sistema';
        } elseif (strpos($catLower, 'civil') !== false || strpos($catLower, 'estructura') !== false) {
            $carreraClave = 'civil';
        }
    }

    // 3) Seleccionar evaluadores candidatos (rol 2 = Evaluador, activo = 1, distinto del autor).
    //    Se prefiere primero a quienes tampoco figuran como profesor del póster y
    //    tienen menor carga actual en la ronda, desempatando al azar.
    $excluirProfs = array_values(array_unique(array_filter(array_map('intval', $idsProfesores), function ($v) use ($id_autor) {
        return $v > 0 && $v !== $id_autor;
    })));

    $esCivil = ($carreraClave === 'civil');
    // Excluir SIEMPRE autor y profesores del póster (conflicto de intereses).
    // FILTRO ESTRICTO DE CARRERA: Civil solo con evaluadores de Civil, Sistemas solo con evaluadores de Sistemas.
    // Sin respaldo cruzado entre carreras: si no queda nadie de esa carrera, no se asigna y se pide asignación manual.
    $condicionCarreraSql = $esCivil
        ? "AND (u.id_evento = 3 OR LOWER(COALESCE(u.carrera, '')) LIKE '%civil%')"
        : "AND (u.id_evento = 1 OR LOWER(COALESCE(u.carrera, '')) LIKE '%sistema%' OR LOWER(COALESCE(u.carrera, '')) LIKE '%software%')";

    $sqlCand = "SELECT u.id, u.correo, u.carrera,
                       CONCAT(u.nombres, ' ', u.apellidos) AS nombre_evaluador,
                       (SELECT COUNT(*) FROM asignaciones_evaluadores ae
                         WHERE ae.id_evaluador = u.id AND ae.id_ronda = ?) AS carga_ronda
                FROM usuario u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                WHERE (u.id_rol = 2 OR LOWER(r.nombre_rol) = 'evaluador')
                  AND u.activo = 1 AND u.desactivado = 0
                  AND u.id <> ?
                  {$condicionCarreraSql}
                  AND NOT EXISTS (
                      SELECT 1 FROM poster_profesores pp
                      WHERE pp.id_poster = ? AND pp.id_usuario = u.id
                  )
                ORDER BY
                  carga_ronda ASC,
                  RAND()";

    $stmtCand = $conexion->prepare($sqlCand);
    if (!$stmtCand) {
        return ['id_ronda' => $id_ronda, 'evaluadores' => [], 'notificaciones' => [], 'sin_evaluadores_disponibles' => true];
    }
    $stmtCand->bind_param("iii", $id_ronda, $id_autor, $id_poster);
    $stmtCand->execute();
    $resCand = $stmtCand->get_result();

    $pool = [];
    while ($ev = $resCand->fetch_assoc()) {
        $idEv = intval($ev['id']);
        if (!in_array($idEv, $excluirProfs, true)) {
            $pool[] = $ev;
        }
    }
    $stmtCand->close();

    $elegidos = array_slice($pool, 0, $nEvaluadores);

    if (empty($elegidos)) {
        return [
            'id_ronda' => $id_ronda,
            'evaluadores' => [],
            'notificaciones' => [],
            'sin_evaluadores_disponibles' => true,
            'mensaje_sin_evaluador' => 'No se registró evaluador porque no hay evaluadores disponibles (los disponibles son quienes subieron el póster o figuran como profesores asignados). Se requiere asignación manual.',
        ];
    }

    // 4) Información de ubicación del póster para incluirla en el correo.
    $textoUbicacion = 'sin ubicar todavía';
    if (function_exists('rh_ubicacion_poster')) {
        $ubi = rh_ubicacion_poster($conexion, $id_poster);
        if (!empty($ubi['etiqueta']) && $ubi['etiqueta'] !== 'sin ubicar todavía') {
            $textoUbicacion = $ubi['etiqueta'];
        } elseif (!empty($ubi['nombre_espacio'])) {
            $textoUbicacion = $ubi['nombre_espacio'] . (isset($ubi['numero']) && $ubi['numero'] ? ' #' . $ubi['numero'] : '');
        }
    } elseif ($id_espacio !== null && $id_espacio !== 'NULL' && intval($id_espacio) > 0) {
        $idEspInt = intval($id_espacio);
        $stmtEsp = $conexion->prepare("
            SELECT e.nombre_espacio,
                   COALESCE((
                       SELECT SUM(e_prev.capacidad)
                       FROM espacios_fisicos e_prev
                       WHERE e_prev.id_evento = e.id_evento
                         AND e_prev.id_espacio < e.id_espacio
                   ), 0) + (
                       SELECT COUNT(*) FROM cargar_posters p2
                       WHERE p2.id_espacio = e.id_espacio AND p2.id <= ? AND p2.activo = 1
                   ) AS puesto
            FROM espacios_fisicos e
            WHERE e.id_espacio = ?
            LIMIT 1
        ");
        if ($stmtEsp) {
            $stmtEsp->bind_param("ii", $id_poster, $idEspInt);
            $stmtEsp->execute();
            $filaEsp = $stmtEsp->get_result()->fetch_assoc();
            $stmtEsp->close();
            if ($filaEsp && !empty($filaEsp['nombre_espacio'])) {
                $puesto = max(1, intval($filaEsp['puesto']));
                $textoUbicacion = $filaEsp['nombre_espacio'] . ' #' . $puesto;
            }
        }
    }

    // 5) Insertar en asignaciones_evaluadores y armar notificaciones por correo.
    $stmtIns = $conexion->prepare("INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador, id_ronda) VALUES (?, ?, ?)
                                   ON DUPLICATE KEY UPDATE id_evaluador = VALUES(id_evaluador)");
    $evaluadoresAsignados = [];
    $notificaciones = [];

    foreach ($elegidos as $ev) {
        $idEv = intval($ev['id']);
        if ($stmtIns) {
            $stmtIns->bind_param("iii", $id_poster, $idEv, $id_ronda);
            $stmtIns->execute();
        }
        $evaluadoresAsignados[] = [
            'id' => $idEv,
            'nombre' => $ev['nombre_evaluador'],
            'correo' => $ev['correo'],
            'carrera' => $ev['carrera'],
        ];

        if (!empty($ev['correo'])) {
            $nombreEvEsc = rh_escapar($ev['nombre_evaluador']);
            $tituloEsc = rh_escapar($tituloPoster);
            $ubicacionEsc = rh_escapar($textoUbicacion);
            $cuerpo = "
                <p>¡Hola, <strong>{$nombreEvEsc}</strong>!</p>
                <p>El sistema te ha asignado automáticamente un nuevo póster para evaluar:</p>
                <ul style='line-height:1.8;'>
                    <li><strong>Póster:</strong> {$tituloEsc}</li>
                    <li><strong>Ubicación física:</strong> {$ubicacionEsc}</li>
                </ul>
                <p>Por favor ingresa a la plataforma en tu panel de evaluador para revisarlo y registrar tu calificación.</p>
            ";
            $notificaciones[] = [
                'correo' => $ev['correo'],
                'asunto' => "Nuevo póster asignado para evaluación: {$tituloPoster}",
                'mensaje' => function_exists('rh_plantilla_correo')
                    ? rh_plantilla_correo('Nuevo póster asignado', $cuerpo)
                    : $cuerpo,
            ];
        }
    }
    if ($stmtIns) $stmtIns->close();

    return [
        'id_ronda' => $id_ronda,
        'evaluadores' => $evaluadoresAsignados,
        'notificaciones' => $notificaciones,
        'sin_evaluadores_disponibles' => false,
    ];
}
?>
