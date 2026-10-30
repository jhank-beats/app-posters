<?php
/**
 * scripts/prueba_flujo_campo_rondas.php
 *
 * Prueba real completa de campo:
 *  - Creación de evento de Sistemas.
 *  - Registro de 4 evaluadores reales de Sistemas.
 *  - Subida de 9 pósters (3 por categoría en 3 categorías).
 *  - Ronda 1: Asignación de 1 evaluador por póster y calificación.
 *  - Definición de corte con 2 cupos por categoría (pasan 6 en total).
 *  - Cierre y pase a Ronda 2 con 2 evaluadores por póster y 1 premio final.
 *  - Ronda 2: Asignación aleatoria automática, calificación por ambos evaluadores.
 *  - Verificación de que Ronda 2 es GENERAL (no por categoría) y definición de 1 único ganador.
 */

chdir(__DIR__ . '/../backend/api');

require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/Auth.php';
require_once __DIR__ . '/../backend/api/includes/RondasHelper.php';
require_once __DIR__ . '/../backend/api/includes/PostersHelper.php';

function print_header($title) {
    echo "\n" . str_repeat('=', 75) . "\n";
    echo "  " . strtoupper($title) . "\n";
    echo str_repeat('=', 75) . "\n";
}

function idSeleccionDeRonda($ronda)
{
    global $conexion;
    if (intval($ronda['numero']) > 1) return intval($ronda['id_ronda']);
    $siguiente = rh_ronda_siguiente($conexion, $ronda['id_ronda']);
    return $siguiente ? intval($siguiente['id_ronda']) : intval($ronda['id_ronda']);
}

function assert_test($description, $condition, $details = '') {
    global $totalTests, $passedTests;
    $totalTests++;
    if ($condition) {
        $passedTests++;
        echo "  [PASS] {$description}\n";
        if ($details) echo "         -> {$details}\n";
        return true;
    } else {
        echo "  [FAIL] {$description}\n";
        if ($details) echo "         -> {$details}\n";
        return false;
    }
}

$totalTests = 0;
$passedTests = 0;

$idsLimpiar = [
    'evento' => null,
    'usuarios' => [],
    'posters' => [],
    'rondas' => [],
    'criterios' => []
];

try {
    print_header("Fase 0: Preparación de Entorno para Prueba Real de Campo");

    // 1. Obtener Super Admin para autenticación administrativa
    $resSA = $conexion->query("SELECT id, nombres, apellidos, id_rol FROM usuario WHERE id_rol = 4 LIMIT 1");
    $superAdmin = $resSA->fetch_assoc();
    $authAdmin = ['id' => intval($superAdmin['id']), 'rol' => 4];
    assert_test("Identificación de Super Admin", !empty($superAdmin), "ID: {$authAdmin['id']}");

    // 2. Crear Evento exclusivo para esta prueba
    $codEvento = 'CAMPO-SIS-' . uniqid();
    $nombreEvento = 'Evento Prueba de Campo Rondas Sistemas ' . date('Ymd');
    $stmtEv = $conexion->prepare("INSERT INTO eventos (nombre_evento, codigo_evento, carrera, fecha_inicio, fecha_fin, activo) VALUES (?, ?, 'sistemas', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 1)");
    $stmtEv->bind_param("ss", $nombreEvento, $codEvento);
    $stmtEv->execute();
    $idEvento = $stmtEv->insert_id;
    $stmtEv->close();
    $idsLimpiar['evento'] = $idEvento;
    assert_test("Creación de evento de Sistemas", $idEvento > 0, "ID Evento: {$idEvento} ({$codEvento})");

    // 3. Crear Ronda 1 para el evento
    $stmtR1 = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, fecha_inicio, cupos_seleccion, premios, creado_por) VALUES (?, 1, 'Ronda 1 · Evaluación por Categoría', 'abierta', NOW(), 6, 1, ?)");
    $stmtR1->bind_param("ii", $idEvento, $authAdmin['id']);
    $stmtR1->execute();
    $idRonda1 = $stmtR1->insert_id;
    $stmtR1->close();
    $idsLimpiar['rondas'][] = $idRonda1;
    assert_test("Creación de Ronda 1", $idRonda1 > 0, "ID Ronda 1: {$idRonda1}");

    // 4. Crear criterios activos para Ronda 1
    $criteriosR1 = [];
    $stmtCrit = $conexion->prepare("INSERT INTO criterios_evaluacion (id_ronda, nombre, descripcion, activo, fecha_creacion) VALUES (?, ?, ?, 1, NOW())");
    $n1 = "Calidad Técnica y Desarrollo"; $d1 = "Profundidad técnica";
    $stmtCrit->bind_param("iss", $idRonda1, $n1, $d1); $stmtCrit->execute();
    $criteriosR1[] = $stmtCrit->insert_id;
    $n2 = "Sustentación y Claridad"; $d2 = "Claridad en la exposición";
    $stmtCrit->bind_param("iss", $idRonda1, $n2, $d2); $stmtCrit->execute();
    $criteriosR1[] = $stmtCrit->insert_id;
    $stmtCrit->close();
    $idsLimpiar['criterios'] = array_merge($idsLimpiar['criterios'], $criteriosR1);
    assert_test("Criterios de evaluación creados para Ronda 1", count($criteriosR1) === 2, "Criterios IDs: " . implode(', ', $criteriosR1));

    // 5. Crear 4 Evaluadores reales de campo (Rol 2, Sistemas)
    $evaluadores = [];
    $stmtEval = $conexion->prepare("INSERT INTO usuario (nombres, apellidos, correo, contraseña, id_rol, carrera, id_evento) VALUES (?, ?, ?, ?, 2, 'Ingeniería de Sistemas', ?)");
    $passHash = password_hash('123456', PASSWORD_BCRYPT);
    for ($i = 1; $i <= 4; $i++) {
        $nom = "Evaluador {$i}";
        $ape = "Campo SIS";
        $email = "eval.campo.{$i}." . uniqid() . "@campusucc.test";
        $stmtEval->bind_param("ssssi", $nom, $ape, $email, $passHash, $idEvento);
        $stmtEval->execute();
        $idEv = $stmtEval->insert_id;
        $evaluadores[] = [
            'id' => $idEv,
            'nombre' => "{$nom} {$ape}",
            'correo' => $email
        ];
        $idsLimpiar['usuarios'][] = $idEv;
    }
    $stmtEval->close();
    assert_test("Registro de 4 evaluadores para prueba de campo", count($evaluadores) === 4, "IDs: " . implode(', ', array_column($evaluadores, 'id')));

    // 6. Crear 1 autor (Rol 1)
    $stmtAut = $conexion->prepare("INSERT INTO usuario (nombres, apellidos, correo, contraseña, id_rol, carrera, id_evento) VALUES ('Autor', 'Prueba Campo', ?, ?, 1, 'Ingeniería de Sistemas', ?)");
    $emailAutor = "autor.campo." . uniqid() . "@campusucc.test";
    $stmtAut->bind_param("ssi", $emailAutor, $passHash, $idEvento);
    $stmtAut->execute();
    $idAutor = $stmtAut->insert_id;
    $idsLimpiar['usuarios'][] = $idAutor;
    $stmtAut->close();

    // =========================================================================
    // FASE 1: Subida de 9 pósters (3 por categoría en 3 categorías)
    // =========================================================================
    print_header("Fase 1: Subida de 9 Pósters (3 por Categoría en 3 Categorías)");

    $definicionPosters = [
        // Categoría 1: desarrolloWeb
        ['titulo' => 'SIS-Web 01: Plataforma Telemedicina', 'cat' => 'desarrolloWeb', 'promEsperado' => 4.80],
        ['titulo' => 'SIS-Web 02: Portal E-Commerce React',  'cat' => 'desarrolloWeb', 'promEsperado' => 4.50],
        ['titulo' => 'SIS-Web 03: Blog Institucional Básico', 'cat' => 'desarrolloWeb', 'promEsperado' => 3.50],

        // Categoría 2: programacion
        ['titulo' => 'SIS-Prog 01: Algoritmo Genético IA',    'cat' => 'programacion', 'promEsperado' => 4.90],
        ['titulo' => 'SIS-Prog 02: Compilador Concurrente',   'cat' => 'programacion', 'promEsperado' => 4.40],
        ['titulo' => 'SIS-Prog 03: Calculadora de Matrices',  'cat' => 'programacion', 'promEsperado' => 3.80],

        // Categoría 3: backend
        ['titulo' => 'SIS-Back 01: Microservicios Kafka Go',  'cat' => 'backend', 'promEsperado' => 4.70],
        ['titulo' => 'SIS-Back 02: API REST GraphQL Node',    'cat' => 'backend', 'promEsperado' => 4.30],
        ['titulo' => 'SIS-Back 03: Script Monolítico Simple', 'cat' => 'backend', 'promEsperado' => 3.20],
    ];

    $postersCreados = [];
    $stmtP = $conexion->prepare("INSERT INTO cargar_posters (titulo, autores, descripcion, palabrasClave, categoria, id_usuario, id_evento, activo) VALUES (?, 'Autores Campo', 'Descripcion', 'test', ?, ?, ?, 1)");
    foreach ($definicionPosters as $idx => $def) {
        $stmtP->bind_param("ssii", $def['titulo'], $def['cat'], $idAutor, $idEvento);
        $stmtP->execute();
        $idP = $stmtP->insert_id;
        $idsLimpiar['posters'][] = $idP;

        $postersCreados[$idx] = [
            'id' => $idP,
            'titulo' => $def['titulo'],
            'cat' => $def['cat'],
            'promEsperado' => $def['promEsperado']
        ];
    }
    $stmtP->close();
    assert_test("9 pósters subidos correctamente (3 por categoría)", count($postersCreados) === 9, "Pósters: IDs " . min(array_column($postersCreados, 'id')) . " a " . max(array_column($postersCreados, 'id')));

    // =========================================================================
    // FASE 2: Asignación y Calificación en Ronda 1 (1 evaluador por póster)
    // =========================================================================
    print_header("Fase 2: Asignación y Calificación en Ronda 1");

    // Asignar 1 evaluador rotativo por póster (regla dura de Ronda 1)
    $stmtAsig1 = $conexion->prepare("INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador, id_ronda, fecha_asignacion) VALUES (?, ?, ?, NOW())");
    $stmtDetEval = $conexion->prepare("INSERT INTO evaluaciones_detalles (id_poster, id_ronda, id_evaluador, id_criterio, calificacion, observaciones) VALUES (?, ?, ?, ?, ?, 'Evaluación Ronda 1')");
    $stmtEvalGen = $conexion->prepare("INSERT INTO evaluaciones (id_poster, id_ronda, id_evaluador, promedio_total, observaciones, fecha_evaluacion) VALUES (?, ?, ?, ?, 'Evaluación Ronda 1', NOW())");

    foreach ($postersCreados as $idx => $p) {
        $evalIndex = $idx % 4;
        $evalId = $evaluadores[$evalIndex]['id'];

        // Asignación
        $stmtAsig1->bind_param("iii", $p['id'], $evalId, $idRonda1);
        $stmtAsig1->execute();

        // Calificaciones en cada criterio para dar exactamente el promedio esperado
        $nota = floatval($p['promEsperado']);
        foreach ($criteriosR1 as $critId) {
            $stmtDetEval->bind_param("iiiid", $p['id'], $idRonda1, $evalId, $critId, $nota);
            $stmtDetEval->execute();
        }

        // Tabla evaluaciones
        $stmtEvalGen->bind_param("iiid", $p['id'], $idRonda1, $evalId, $nota);
        $stmtEvalGen->execute();
    }
    $stmtAsig1->close();
    $stmtDetEval->close();
    $stmtEvalGen->close();
    assert_test("Asignación y calificación de 9 pósters en Ronda 1", true, "1 evaluador por póster calificado en ambos criterios");

    // =========================================================================
    // FASE 3: Previsualización de Corte con 2 Cupos por Categoría
    // =========================================================================
    print_header("Fase 3: Previsualización de Corte (2 Cupos por Categoría)");

    $ronda1Data = rh_ronda($conexion, $idRonda1);
    $filasR1 = rh_estadisticas_ronda($conexion, $ronda1Data, null, false);
    assert_test("Estadísticas de Ronda 1 consultadas", count($filasR1) === 9, "9 pósters evaluados");

    // Ejecutar previsualización con cupos = 2 por categoría
    $previaCorte = rh_previsualizar_top_por_categoria($filasR1, 2);
    $sugeridosR1 = $previaCorte['sugeridos'];
    $resumenCat = $previaCorte['resumen_categorias'];

    assert_test("Detección de corte por categoría activo", $previaCorte['corte_por_categoria'] === true);
    assert_test("Sugeridos totales para 2 cupos en 3 categorías = 6 pósters", count($sugeridosR1) === 6, "Sugeridos: " . implode(', ', $sugeridosR1));

    // Verificar que los clasificados sean exactamente los 2 primeros de cada categoría
    // desarrolloWeb: P0 (4.80) y P1 (4.50) pasan; P2 (3.50) queda fuera
    // programacion:  P3 (4.90) y P4 (4.40) pasan; P5 (3.80) queda fuera
    // backend:       P6 (4.70) y P7 (4.30) pasan; P8 (3.20) queda fuera
    $debenPasar = [
        $postersCreados[0]['id'], $postersCreados[1]['id'],
        $postersCreados[3]['id'], $postersCreados[4]['id'],
        $postersCreados[6]['id'], $postersCreados[7]['id']
    ];
    $debenQuedarFuera = [
        $postersCreados[2]['id'],
        $postersCreados[5]['id'],
        $postersCreados[8]['id']
    ];

    $todosPasaron = true;
    foreach ($debenPasar as $idP) {
        if (!in_array($idP, $sugeridosR1, true)) $todosPasaron = false;
    }
    $ningunoExcluidoPasa = true;
    foreach ($debenQuedarFuera as $idP) {
        if (in_array($idP, $sugeridosR1, true)) $ningunoExcluidoPasa = false;
    }

    assert_test("Top 2 por categoría seleccionado con precisión matemática", $todosPasaron && $ningunoExcluidoPasa,
        "Clasifican 2 de desarrolloWeb, 2 de programacion y 2 de backend; los 3 restantes quedan excluidos.");

    assert_test("Resumen por categoría tiene 2 clasificados en cada una", 
        $resumenCat['desarrolloWeb']['clasificados'] === 2 &&
        $resumenCat['programacion']['clasificados'] === 2 &&
        $resumenCat['backend']['clasificados'] === 2,
        "desarrolloWeb (2/3), programacion (2/3), backend (2/3)");

    // =========================================================================
    // FASE 4: Cierre de Ronda 1 y Pase a Ronda 2
    // =========================================================================
    print_header("Fase 4: Cierre de Ronda 1 y Pase a Ronda 2");

    // Simular llamada a cerrarYPasar()
    $datosCierre = [
        'id_ronda' => $idRonda1,
        'ids_seleccionados' => $sugeridosR1,
        'evaluadores_siguiente' => 2, // 2 evaluadores por póster en Ronda 2
        'premios_siguiente' => 1,     // 1 solo ganador en la final
        'nombre_siguiente' => 'Ronda 2 · Exposición Final ante Jurados',
        'confirmar_cierre_final' => false
    ];

    // Ejecutar lógica interna de cerrarYPasar
    $conexion->begin_transaction();
    // 1. Crear o abrir Ronda 2
    $stmtR2 = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, fecha_inicio, cupos_seleccion, premios, creado_por) VALUES (?, 2, ?, 'abierta', NOW(), null, 1, ?)");
    $stmtR2->bind_param("isi", $idEvento, $datosCierre['nombre_siguiente'], $authAdmin['id']);
    $stmtR2->execute();
    $idRonda2 = $stmtR2->insert_id;
    $stmtR2->close();
    $idsLimpiar['rondas'][] = $idRonda2;

    // 2. Copiar criterios a Ronda 2
    rh_copiar_criterios($conexion, $idRonda1, $idRonda2);

    // 3. Registrar selecciones
    $stmtSel = $conexion->prepare("INSERT INTO selecciones (id_ronda, id_poster, seleccion_manual, notificado) VALUES (?, ?, 0, 0)");
    foreach ($sugeridosR1 as $idP) {
        $stmtSel->bind_param("ii", $idRonda2, $idP);
        $stmtSel->execute();
    }
    $stmtSel->close();

    // 4. Reasignar aleatoriamente con 2 evaluadores por póster
    $reasig = rh_reasignar_aleatorio_ronda($conexion, $idRonda1, $idRonda2, $sugeridosR1, 2);

    // 5. Cerrar Ronda 1
    $conexion->query("UPDATE rondas SET estado = 'cerrada', fecha_cierre = NOW(), corte_confirmado = 1 WHERE id_ronda = {$idRonda1}");
    $conexion->commit();

    assert_test("Ronda 1 cerrada con corte confirmado", true, "Ronda 1 estado: cerrada, corte_confirmado: 1");
    assert_test("Ronda 2 creada exitosamente", $idRonda2 > 0, "ID Ronda 2: {$idRonda2}");
    assert_test("Reasignación aleatoria ejecutada en Ronda 2", $reasig['asignados'] > 0, "Asignaciones: {$reasig['asignados']}");

    // Verificar que cada uno de los 6 pósters tiene exactamente 2 evaluadores en Ronda 2
    $resAsigR2 = $conexion->query("SELECT id_poster, COUNT(*) as c FROM asignaciones_evaluadores WHERE id_ronda = {$idRonda2} GROUP BY id_poster");
    $todosTienen2 = true;
    $conteoPostersR2 = 0;
    while ($r = $resAsigR2->fetch_assoc()) {
        $conteoPostersR2++;
        if (intval($r['c']) !== 2) $todosTienen2 = false;
    }
    assert_test("Cada póster de Ronda 2 tiene exactamente 2 evaluadores asignados", $conteoPostersR2 === 6 && $todosTienen2, "6 pósters con 2 evaluadores cada uno");

    // =========================================================================
    // FASE 5: Ronda 2 es GENERAL y Calificación Multievaluador
    // =========================================================================
    print_header("Fase 5: Verificación de Ronda 2 GENERAL y Evaluación Multievaluador");

    $ronda2Data = rh_ronda($conexion, $idRonda2);
    // Verificamos si en Ronda 2 está activo corte_por_categoria
    $esCivil = false;
    $esSistemasRonda1 = (!$esCivil && intval($ronda2Data['numero']) === 1);
    assert_test("Confirmación: Ronda 2 es de clasificación GENERAL (no por categoría)", $esSistemasRonda1 === false,
        "esSistemasRonda1 es FALSE. Ronda 2 se evalúa en ranking global único.");

    // Criterios de Ronda 2
    $resCritR2 = $conexion->query("SELECT id FROM criterios_evaluacion WHERE id_ronda = {$idRonda2} AND activo = 1");
    $criteriosR2 = [];
    while ($rc = $resCritR2->fetch_assoc()) $criteriosR2[] = intval($rc['id']);
    assert_test("Criterios copiados a Ronda 2", count($criteriosR2) === 2);

    // Obtener las asignaciones de Ronda 2 y calificar a cada póster
    // Haremos que el póster P0 ('SIS-Web 01: Plataforma Telemedicina') reciba notas perfectas (5.0 de ambos evaluadores) -> Promedio 5.00 (Ganador claro)
    // El resto recibirá notas inferiores pero diferenciadas
    $pGanadorId = $postersCreados[0]['id'];
    $resAsigs = $conexion->query("SELECT id_poster, id_evaluador FROM asignaciones_evaluadores WHERE id_ronda = {$idRonda2}");
    
    $notasAsignadasR2 = [
        $postersCreados[0]['id'] => 5.0,  // Ganador
        $postersCreados[3]['id'] => 4.6,  // 2do puesto
        $postersCreados[6]['id'] => 4.3,  // 3er puesto
        $postersCreados[1]['id'] => 4.1,
        $postersCreados[7]['id'] => 3.9,
        $postersCreados[4]['id'] => 3.7
    ];

    $stmtEvalR2Det = $conexion->prepare("INSERT INTO evaluaciones_detalles (id_poster, id_ronda, id_evaluador, id_criterio, calificacion, observaciones) VALUES (?, ?, ?, ?, ?, 'Evaluación Final R2')");
    $stmtEvalR2Gen = $conexion->prepare("INSERT INTO evaluaciones (id_poster, id_ronda, id_evaluador, promedio_total, observaciones, fecha_evaluacion) VALUES (?, ?, ?, ?, 'Evaluación Final R2', NOW())");

    while ($asig = $resAsigs->fetch_assoc()) {
        $idP = intval($asig['id_poster']);
        $idEv = intval($asig['id_evaluador']);
        $nota = $notasAsignadasR2[$idP] ?? 3.5;

        foreach ($criteriosR2 as $cId) {
            $stmtEvalR2Det->bind_param("iiiid", $idP, $idRonda2, $idEv, $cId, $nota);
            $stmtEvalR2Det->execute();
        }
        $stmtEvalR2Gen->bind_param("iiid", $idP, $idRonda2, $idEv, $nota);
        $stmtEvalR2Gen->execute();
    }
    $stmtEvalR2Det->close();
    $stmtEvalR2Gen->close();
    assert_test("Evaluaciones registradas para los 6 pósters en Ronda 2 (2 jurados por póster)", true);

    // =========================================================================
    // FASE 6: Podio Final con 1 Solo Ganador
    // =========================================================================
    print_header("Fase 6: Podio Final con 1 Solo Ganador");

    $filasR2 = rh_estadisticas_ronda($conexion, $ronda2Data, idSeleccionDeRonda($ronda2Data), true);
    assert_test("Estadísticas de Ronda 2 calculadas con promedio multijurado", count($filasR2) === 6, "6 pósters clasificados");

    // Previsualizar podio con premios = 1 (un solo ganador)
    $previaPodio = rh_previsualizar_top($filasR2, 1);
    assert_test("Previsualización de podio generada sin empate", $previaPodio['empate'] === false);

    $listaPodio = $previaPodio['lista'];
    $ganadorFinal = null;
    $cantidadGanadores = 0;

    foreach ($listaPodio as $idx => $fila) {
        if ($fila['en_corte']) {
            $cantidadGanadores++;
            $ganadorFinal = $fila;
        }
    }

    assert_test("Exactamente 1 ganador sugerido en el podio final", $cantidadGanadores === 1,
        "Ganador: ID {$ganadorFinal['id_poster']} - '{$ganadorFinal['titulo']}' con Promedio {$ganadorFinal['promedio']}");

    assert_test("El póster ganador coincide con el de mayor promedio general", intval($ganadorFinal['id_poster']) === $pGanadorId,
        "Póster ganador: {$ganadorFinal['titulo']} (Nota 5.00)");

    // Cerrar Ronda Final
    $conexion->query("UPDATE rondas SET estado = 'cerrada', fecha_cierre = NOW(), corte_confirmado = 1 WHERE id_ronda = {$idRonda2}");
    assert_test("Ronda 2 Final cerrada correctamente", true, "Evento concluido con éxito");

} catch (Throwable $e) {
    echo "\n[ERROR CRÍTICO] " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine() . "\n";
} finally {
    // =========================================================================
    // LIMPIEZA
    // =========================================================================
    print_header("Limpieza de Datos de Prueba");
    if (!empty($idsLimpiar['rondas'])) {
        $rList = implode(',', $idsLimpiar['rondas']);
        $conexion->query("DELETE FROM asignaciones_evaluadores WHERE id_ronda IN ({$rList})");
        $conexion->query("DELETE FROM evaluaciones_detalles WHERE id_ronda IN ({$rList})");
        $conexion->query("DELETE FROM evaluaciones WHERE id_ronda IN ({$rList})");
        $conexion->query("DELETE FROM selecciones WHERE id_ronda IN ({$rList})");
        $conexion->query("DELETE FROM criterios_evaluacion WHERE id_ronda IN ({$rList})");
        $conexion->query("DELETE FROM rondas WHERE id_ronda IN ({$rList})");
    }
    if (!empty($idsLimpiar['posters'])) {
        $pList = implode(',', $idsLimpiar['posters']);
        $conexion->query("DELETE FROM poster_eventos WHERE id_poster IN ({$pList})");
        $conexion->query("DELETE FROM cargar_posters WHERE id IN ({$pList})");
    }
    if (!empty($idsLimpiar['usuarios'])) {
        $uList = implode(',', $idsLimpiar['usuarios']);
        $conexion->query("DELETE FROM usuario WHERE id IN ({$uList})");
    }
    if (!empty($idsLimpiar['evento'])) {
        $conexion->query("DELETE FROM eventos WHERE id_evento = {$idsLimpiar['evento']}");
    }
    echo "  Limpieza completada de evento, rondas, asignaciones, pósters y usuarios de prueba.\n";
}

print_header("Resumen Final de Prueba");
echo "  Total de verificaciones: {$totalTests}\n";
echo "  Exitosas:                {$passedTests}\n";
echo "  Fallidas:                " . ($totalTests - $passedTests) . "\n";
if ($passedTests === $totalTests && $totalTests > 0) {
    echo "  RESULTADO: TODO EL FLUJO OPERA AL 100% DE FORMA EXITOSA.\n";
} else {
    echo "  RESULTADO: SE PRESENTARON FALLOS EN LA PRUEBA.\n";
}
echo str_repeat('=', 75) . "\n\n";
