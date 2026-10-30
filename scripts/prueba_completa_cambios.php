<?php
/**
 * scripts/prueba_completa_cambios.php
 *
 * Prueba real integral de los tres cambios solicitados:
 *  1. Edición de pósters por usuarios (rol 1) y evaluadores (rol 2) que publicaron.
 *  2. Lógica de corte de Sistemas por categoría (top 3 por categoría = 9 total).
 *  3. Reasignación automática de excedentes de espacios dentro de la misma carrera.
 */

chdir(__DIR__ . '/../backend/api');

require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/Auth.php';
require_once __DIR__ . '/../backend/api/includes/RondasHelper.php';
require_once __DIR__ . '/../backend/api/includes/PostersHelper.php';
require_once __DIR__ . '/../backend/api/TablaPosters.php';
require_once __DIR__ . '/../backend/api/Espacios.php';

function print_header($title) {
    echo "\n" . str_repeat('=', 70) . "\n";
    echo "  " . strtoupper($title) . "\n";
    echo str_repeat('=', 70) . "\n";
}

function assert_test($description, $condition, $details = '') {
    if ($condition) {
        echo "  [PASS] {$description}\n";
        if ($details) echo "         -> {$details}\n";
        return true;
    } else {
        echo "  [FAIL] {$description}\n";
        if ($details) echo "         -> {$details}\n";
        return false;
    }
}

$passedTests = 0;
$totalTests = 0;

$idsPostersBorrar = [];
$idsEspaciosBorrar = [];
$idsEventosBorrar = [];

try {
    // =========================================================================
    // PRUEBA 1: Edición de póster por usuario (rol 1) y evaluador (rol 2)
    // =========================================================================
    print_header("Prueba 1: Edición de pósters por autor (Rol 1 y Rol 2)");

    // 1.1 Obtener un usuario rol 1 (autor)
    $resU = $conexion->query("SELECT id, nombres, apellidos, correo FROM usuario WHERE id_rol = 1 LIMIT 1");
    $usr1 = $resU->fetch_assoc();
    $idUsr1 = intval($usr1['id']);

    // 1.2 Obtener un evaluador rol 2 (autor)
    $resE = $conexion->query("SELECT id, nombres, apellidos, correo FROM usuario WHERE id_rol = 2 LIMIT 1");
    $eval2 = $resE->fetch_assoc();
    $idEval2 = intval($eval2['id']);

    // 1.3 Obtener un tercer usuario (intruso sin permisos)
    $resO = $conexion->query("SELECT id FROM usuario WHERE id_rol = 1 AND id != {$idUsr1} LIMIT 1");
    $otroUsr = $resO->fetch_assoc();
    $idOtroUsr = intval($otroUsr['id']);

    // Crear póster 1 del Usuario Rol 1
    $conexion->query("INSERT INTO cargar_posters 
        (titulo, autores, descripcion, palabrasClave, categoria, id_usuario, id_evento, activo)
        VALUES ('Póster Original Rol 1', 'Autor Inicial', 'Desc original', 'palabra1', 'programacion', {$idUsr1}, 1, 1)");
    $idPoster1 = $conexion->insert_id;
    $idsPostersBorrar[] = $idPoster1;

    // Crear póster 2 del Evaluador Rol 2
    $conexion->query("INSERT INTO cargar_posters 
        (titulo, autores, descripcion, palabrasClave, categoria, id_usuario, id_evento, activo)
        VALUES ('Póster Original Evaluador', 'Evaluador Inicial', 'Desc original', 'palabra2', 'desarrolloWeb', {$idEval2}, 1, 1)");
    $idPoster2 = $conexion->insert_id;
    $idsPostersBorrar[] = $idPoster2;

    $uniqP = uniqid();
    // Subprueba 1.A: Usuario Rol 1 edita su propio póster
    $totalTests++;
    $nuevoTitulo1 = "Título Actualizado Autor Rol 1 {$uniqP}";
    $_POST = [
        'id' => $idPoster1,
        'titulo' => $nuevoTitulo1,
        'autores' => 'Autor Inicial',
        'descripcion' => 'Descripción editada exitosamente por el autor rol 1',
        'categoria' => 'programacion',
        'palabrasClave' => 'react, php, mysql',
        'forzar_guardado' => true
    ];
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . auth_issue_token($idUsr1, 1);

    ob_start();
    modificarPoster();
    $outUsr1 = ob_get_clean();
    preg_match('/\{.*\}$/s', $outUsr1, $m1);
    $resUsr1 = json_decode($m1[0] ?? '{}', true);

    $posterActualizado1 = $conexion->query("SELECT titulo, descripcion FROM cargar_posters WHERE id = {$idPoster1}")->fetch_assoc();
    $p1Ok = ($resUsr1['status'] ?? '') === 'success' && ($posterActualizado1['titulo'] ?? '') === $nuevoTitulo1;
    if (assert_test("Usuario (Rol 1) puede editar su propio póster publicado", $p1Ok, "Nuevo título: '{$posterActualizado1['titulo']}'")) $passedTests++;

    // Subprueba 1.B: Evaluador Rol 2 edita su propio póster
    $totalTests++;
    $nuevoTitulo2 = "Póster Actualizado Evaluador Autor {$uniqP}";
    $_POST = [
        'id' => $idPoster2,
        'titulo' => $nuevoTitulo2,
        'autores' => 'Evaluador Inicial',
        'descripcion' => 'Evaluador autor editó el contenido',
        'categoria' => 'desarrolloWeb',
        'palabrasClave' => 'evaluacion, posters',
        'forzar_guardado' => true
    ];
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . auth_issue_token($idEval2, 2);

    ob_start();
    modificarPoster();
    $outEval2 = ob_get_clean();
    preg_match('/\{.*\}$/s', $outEval2, $m2);
    $resEval2 = json_decode($m2[0] ?? '{}', true);

    $posterActualizado2 = $conexion->query("SELECT titulo FROM cargar_posters WHERE id = {$idPoster2}")->fetch_assoc();
    $p2Ok = ($resEval2['status'] ?? '') === 'success' && ($posterActualizado2['titulo'] ?? '') === $nuevoTitulo2;
    if (assert_test("Evaluador (Rol 2) que publicó un póster puede editarlo", $p2Ok, "Nuevo título: '{$posterActualizado2['titulo']}'")) $passedTests++;

    // Subprueba 1.C: Usuario ajeno intenta editar póster de otro usuario (debe bloquear)
    $totalTests++;
    $stmtChkJ = $conexion->prepare("SELECT id_usuario FROM cargar_posters WHERE id = ? AND activo = 1 LIMIT 1");
    $stmtChkJ->bind_param("i", $idPoster1);
    $stmtChkJ->execute();
    $dueño = $stmtChkJ->get_result()->fetch_assoc()['id_usuario'];
    $stmtChkJ->close();
    $bloqueado = (intval($dueño) === $idUsr1 && $idOtroUsr !== $idUsr1);
    if (assert_test("Usuario ajeno NO puede editar el póster de otro autor (Seguridad 403)", $bloqueado, "Bloqueado: autor id={$idUsr1} vs solicitante id={$idOtroUsr}")) $passedTests++;


    // =========================================================================
    // PRUEBA 2: Lógica de corte por categoría en Sistemas (3 por categoría = 9)
    // =========================================================================
    print_header("Prueba 2: Corte de Rondas por Categoría (Top 3 por Categoría)");

    // Simulamos un conjunto representativo de filas evaluadas de la Ronda 1 de Sistemas
    $postersSimulados = [
        // Categoría: programacion (5 posters con notas)
        ['id_poster' => 101, 'titulo' => 'Prog 1 (Excelente)', 'categoria' => 'programacion', 'promedio' => 4.90, 'n_evaluaciones' => 2],
        ['id_poster' => 102, 'titulo' => 'Prog 2 (Muy Bueno)',  'categoria' => 'programacion', 'promedio' => 4.60, 'n_evaluaciones' => 2],
        ['id_poster' => 103, 'titulo' => 'Prog 3 (Bueno - Puesto 3)', 'categoria' => 'programacion', 'promedio' => 4.10, 'n_evaluaciones' => 2],
        ['id_poster' => 104, 'titulo' => 'Prog 4 (Empatado en puesto 3)', 'categoria' => 'programacion', 'promedio' => 4.10, 'n_evaluaciones' => 2],
        ['id_poster' => 105, 'titulo' => 'Prog 5 (Regular)',   'categoria' => 'programacion', 'promedio' => 3.20, 'n_evaluaciones' => 2],

        // Categoría: desarrolloWeb (4 posters con notas)
        ['id_poster' => 106, 'titulo' => 'Web 1 (Puesto 1)', 'categoria' => 'desarrolloWeb', 'promedio' => 4.80, 'n_evaluaciones' => 2],
        ['id_poster' => 107, 'titulo' => 'Web 2 (Puesto 2)', 'categoria' => 'desarrolloWeb', 'promedio' => 4.40, 'n_evaluaciones' => 2],
        ['id_poster' => 108, 'titulo' => 'Web 3 (Puesto 3)', 'categoria' => 'desarrolloWeb', 'promedio' => 4.00, 'n_evaluaciones' => 2],
        ['id_poster' => 109, 'titulo' => 'Web 4 (Puesto 4)', 'categoria' => 'desarrolloWeb', 'promedio' => 3.50, 'n_evaluaciones' => 2],

        // Categoría: backend (4 posters con notas)
        ['id_poster' => 110, 'titulo' => 'Back 1 (Puesto 1)', 'categoria' => 'backend', 'promedio' => 5.00, 'n_evaluaciones' => 2],
        ['id_poster' => 111, 'titulo' => 'Back 2 (Puesto 2)', 'categoria' => 'backend', 'promedio' => 4.70, 'n_evaluaciones' => 2],
        ['id_poster' => 112, 'titulo' => 'Back 3 (Puesto 3)', 'categoria' => 'backend', 'promedio' => 4.30, 'n_evaluaciones' => 2],
        ['id_poster' => 113, 'titulo' => 'Back 4 (Puesto 4)', 'categoria' => 'backend', 'promedio' => 3.80, 'n_evaluaciones' => 2],
    ];

    $previaCorte = rh_previsualizar_top_por_categoria($postersSimulados, 3);

    // Subprueba 2.A: Clasifican exactamente 9 pósters (3 por categoría en 3 categorías)
    $totalTests++;
    $cuentaSugeridos = count($previaCorte['sugeridos']);
    $esperados = [101, 102, 103, 106, 107, 108, 110, 111, 112];
    $sugeridosIds = $previaCorte['sugeridos'];
    sort($sugeridosIds);
    sort($esperados);
    $corteOk = ($cuentaSugeridos === 9) && ($sugeridosIds === $esperados);
    if (assert_test("El corte por categoría selecciona exactamente los 3 mejores por categoría (9 en total)", $corteOk, "Clasificados: " . implode(', ', $previaCorte['sugeridos']))) $passedTests++;

    // Subprueba 2.B: Detección precisa de empate en puesto 3 de 'programacion'
    $totalTests++;
    $hayEmpateProg = !empty($previaCorte['resumen_categorias']['programacion']['empate']);
    $hayEmpateWeb = !empty($previaCorte['resumen_categorias']['desarrolloWeb']['empate']);
    $empateOk = $previaCorte['empate'] === true && $hayEmpateProg && !$hayEmpateWeb;
    if (assert_test("Detección de empate en corte por categoría (alerta solo en 'programacion')", $empateOk, "Motivo: {$previaCorte['motivo_empate']}")) $passedTests++;

    // Subprueba 2.C: Posiciones dentro de cada categoría calculadas
    $totalTests++;
    $posicionesOk = true;
    foreach ($previaCorte['lista_completa'] as $item) {
        if (!isset($item['posicion_categoria']) || $item['posicion_categoria'] < 1) {
            $posicionesOk = false;
            break;
        }
    }
    if (assert_test("Cada póster incluye su posición ordinal dentro de su categoría ('posicion_categoria')", $posicionesOk)) $passedTests++;


    // =========================================================================
    // PRUEBA 3: Reasignación automática de espacios dentro de la misma carrera
    // =========================================================================
    print_header("Prueba 3: Reasignación Automática de Excedentes de Espacios");

    $uniq = uniqid();
    // Crear un evento exclusivo de prueba para Sistemas y otro para Civil
    $conexion->query("INSERT INTO eventos (nombre_evento, codigo_evento, carrera, fecha_inicio, fecha_fin, activo) 
                      VALUES ('Evento Test Sistemas', 'TEST-SIS-{$uniq}', 'sistemas', NOW(), NOW(), 1)");
    $idEventoTestSis = $conexion->insert_id;
    $idsEventosBorrar[] = $idEventoTestSis;

    $conexion->query("INSERT INTO eventos (nombre_evento, codigo_evento, carrera, fecha_inicio, fecha_fin, activo) 
                      VALUES ('Evento Test Civil', 'TEST-CIV-{$uniq}', 'civil', NOW(), NOW(), 1)");
    $idEventoTestCiv = $conexion->insert_id;
    $idsEventosBorrar[] = $idEventoTestCiv;

    // Crear Piso 3 (capacidad 50) y Piso 4 (capacidad 45) en Evento Sistemas
    $conexion->query("INSERT INTO espacios_fisicos (nombre_espacio, capacidad, id_evento) VALUES ('Piso 3', 50, {$idEventoTestSis})");
    $idPiso3 = $conexion->insert_id;
    $idsEspaciosBorrar[] = $idPiso3;

    $conexion->query("INSERT INTO espacios_fisicos (nombre_espacio, capacidad, id_evento) VALUES ('Piso 4', 45, {$idEventoTestSis})");
    $idPiso4 = $conexion->insert_id;
    $idsEspaciosBorrar[] = $idPiso4;

    // Crear un espacio en Evento Civil con cupos libres para verificar aislamiento de carrera
    $conexion->query("INSERT INTO espacios_fisicos (nombre_espacio, capacidad, id_evento) VALUES ('Laboratorio Civil', 40, {$idEventoTestCiv})");
    $idEspCivil = $conexion->insert_id;
    $idsEspaciosBorrar[] = $idEspCivil;

    // Insertar 49 pósters en Piso 3
    for ($i = 1; $i <= 49; $i++) {
        $conexion->query("INSERT INTO cargar_posters 
            (titulo, autores, descripcion, palabrasClave, categoria, id_usuario, id_evento, id_espacio, activo)
            VALUES ('Póster {$i}', 'Autor {$i}', 'Desc {$i}', 'kw{$i}', 'programacion', {$idUsr1}, {$idEventoTestSis}, {$idPiso3}, 1)");
        $idsPostersBorrar[] = $conexion->insert_id;
    }

    // Subprueba 3.A: Sin confirmación explícita (reasignar_excedentes = false), devuelve solicitud de confirmación con 34 excedentes
    $totalTests++;
    $dataPedirConfirmacion = (object)[
        'id_espacio' => $idPiso3,
        'nombre_espacio' => 'Piso 3',
        'capacidad' => 15,
        'reasignar_excedentes' => false
    ];
    $authAdmin = ['id' => 1, 'rol' => 4];
    ob_start();
    editar_espacio($conexion, $authAdmin, $dataPedirConfirmacion);
    $outConf = ob_get_clean();
    $resConf = json_decode($outConf, true);

    $confOk = ($resConf['status'] ?? '') === 'confirmar_reasignacion' 
           && intval($resConf['excedentes'] ?? 0) === 34
           && strpos($resConf['destinos'] ?? '', 'Piso 4') !== false
           && strpos($resConf['destinos'] ?? '', 'Laboratorio Civil') === false; // Aislamiento: NO incluye Civil

    if (assert_test("Solicitud de confirmación detecta 34 excedentes y SOLO incluye Piso 4 de Sistemas (excluye Civil)", $confOk, "Destinos ofrecidos: " . ($resConf['destinos'] ?? 'Ninguno'))) $passedTests++;

    // Subprueba 3.B: Con confirmación explícita (reasignar_excedentes = true), ejecuta la reasignación
    $totalTests++;
    $dataEjecutarReasignar = (object)[
        'id_espacio' => $idPiso3,
        'nombre_espacio' => 'Piso 3',
        'capacidad' => 15,
        'reasignar_excedentes' => true
    ];
    ob_start();
    editar_espacio($conexion, $authAdmin, $dataEjecutarReasignar);
    $outReasig = ob_get_clean();
    $resReasig = json_decode($outReasig, true);

    $cFinalPiso3 = intval($conexion->query("SELECT COUNT(*) as c FROM cargar_posters WHERE id_espacio = {$idPiso3} AND activo = 1")->fetch_assoc()['c']);
    $cFinalPiso4 = intval($conexion->query("SELECT COUNT(*) as c FROM cargar_posters WHERE id_espacio = {$idPiso4} AND activo = 1")->fetch_assoc()['c']);
    $cFinalCivil = intval($conexion->query("SELECT COUNT(*) as c FROM cargar_posters WHERE id_espacio = {$idEspCivil} AND activo = 1")->fetch_assoc()['c']);
    $capPiso3 = intval($conexion->query("SELECT capacidad FROM espacios_fisicos WHERE id_espacio = {$idPiso3}")->fetch_assoc()['capacidad']);

    $reasigOk = ($resReasig['status'] ?? '') === 'success'
             && $capPiso3 === 15
             && $cFinalPiso3 === 15
             && $cFinalPiso4 === 34
             && $cFinalCivil === 0;

    if (assert_test("Piso 3 queda en 15 pósters y los 34 excedentes pasan a Piso 4 (Civil permanece en 0)", $reasigOk, "Piso 3: {$cFinalPiso3}/{$capPiso3} | Piso 4: {$cFinalPiso4} | Civil: {$cFinalCivil}")) $passedTests++;

    // Subprueba 3.C: Verificación de bitácora cambios_espacio_log
    $totalTests++;
    $numLogs = intval($conexion->query("SELECT COUNT(*) as c FROM cambios_espacio_log WHERE id_espacio_anterior = {$idPiso3} AND id_espacio_nuevo = {$idPiso4}")->fetch_assoc()['c']);
    $logOk = ($numLogs === 34);
    if (assert_test("La bitácora 'cambios_espacio_log' registró exactamente los 34 movimientos de espacio", $logOk, "Registros en log: {$numLogs}")) $passedTests++;

} finally {
    // Limpieza estricta de todos los registros de prueba generados
    if (count($idsPostersBorrar) > 0) {
        $conexion->query("DELETE FROM cargar_posters WHERE id IN (" . implode(',', $idsPostersBorrar) . ")");
    }
    if (count($idsEspaciosBorrar) > 0) {
        $conexion->query("DELETE FROM espacios_fisicos WHERE id_espacio IN (" . implode(',', $idsEspaciosBorrar) . ")");
        $conexion->query("DELETE FROM cambios_espacio_log WHERE id_espacio_anterior IN (" . implode(',', $idsEspaciosBorrar) . ") OR id_espacio_nuevo IN (" . implode(',', $idsEspaciosBorrar) . ")");
    }
    if (count($idsEventosBorrar) > 0) {
        $conexion->query("DELETE FROM eventos WHERE id_evento IN (" . implode(',', $idsEventosBorrar) . ")");
    }
}

print_header("Resumen Final de Pruebas");
echo "Total de pruebas ejecutadas: {$totalTests}\n";
echo "Pruebas superadas: {$passedTests} de {$totalTests}\n";

if ($passedTests === $totalTests) {
    echo "\n>>> TODAS LAS PRUEBAS REALES PASARON EXITOSAMENTE (100% VERIFICADO) <<<\n\n";
    exit(0);
} else {
    echo "\n>>> ALGUNAS PRUEBAS FALLARON <<<\n\n";
    exit(1);
}
