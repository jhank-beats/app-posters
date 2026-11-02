<?php
/**
 * Suite de pruebas automatizadas para:
 *  1. Control de publicación de pósters y horarios por carrera (Sistemas vs Civil).
 *  2. Aislamiento de listado de espacios físicos y pósters por carrera.
 */

require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/PostersHelper.php';

$pasaron = 0;
$fallaron = 0;

function afirmar(bool $condicion, string $nombre, string $detalle = ''): void {
    global $pasaron, $fallaron;
    if ($condicion) {
        $pasaron++;
        echo "  [OK]   {$nombre}\n";
    } else {
        $fallaron++;
        echo "  [FAIL] {$nombre}" . ($detalle !== '' ? " -> {$detalle}" : '') . "\n";
    }
}

echo "=================================================================\n";
echo " PRUEBAS: ESPACIOS POR CARRERA Y CONTROL DE PUBLICACIÓN DE PÓSTERS\n";
echo "=================================================================\n\n";

// 1. Asegurar columnas en tabla eventos
ph_asegurar_columnas_publicacion($conexion);

$columnasEsperadas = [
    'publicacion_habilitada',
    'usar_horario_publicacion',
    'publicacion_inicio',
    'publicacion_fin',
];
foreach ($columnasEsperadas as $col) {
    $resCol = $conexion->query("SHOW COLUMNS FROM eventos LIKE '{$col}'");
    afirmar($resCol && $resCol->num_rows > 0, "Columna '{$col}' existe en tabla eventos");
}

// 2. Pruebas unitarias de ph_estado_publicacion_evento()
$tz = new DateTimeZone('America/Bogota');
$ahora = new DateTimeImmutable('now', $tz);

$evManualCerrado = [
    'nombre_evento' => 'Evento Sistemas Test',
    'publicacion_habilitada' => 0,
    'usar_horario_publicacion' => 0,
    'publicacion_inicio' => null,
    'publicacion_fin' => null,
];
$est1 = ph_estado_publicacion_evento($evManualCerrado);
afirmar($est1['abierta'] === false && $est1['estado_codigo'] === 'cerrada_manual', 'Cierre manual bloquea publicación');

$evManualAbierto = [
    'nombre_evento' => 'Evento Sistemas Test',
    'publicacion_habilitada' => 1,
    'usar_horario_publicacion' => 0,
    'publicacion_inicio' => null,
    'publicacion_fin' => null,
];
$est2 = ph_estado_publicacion_evento($evManualAbierto);
afirmar($est2['abierta'] === true && $est2['estado_codigo'] === 'abierta', 'Habilitación manual sin horario permite publicación');

$evHorarioFuturo = [
    'nombre_evento' => 'Evento Sistemas Test',
    'publicacion_habilitada' => 1,
    'usar_horario_publicacion' => 1,
    'publicacion_inicio' => $ahora->modify('+2 hours')->format('Y-m-d H:i:s'),
    'publicacion_fin' => $ahora->modify('+5 hours')->format('Y-m-d H:i:s'),
];
$est3 = ph_estado_publicacion_evento($evHorarioFuturo);
afirmar($est3['abierta'] === false && $est3['estado_codigo'] === 'pendiente_inicio', 'Horario futuro bloquea publicación antes de la hora de inicio');

$evHorarioActivo = [
    'nombre_evento' => 'Evento Sistemas Test',
    'publicacion_habilitada' => 1,
    'usar_horario_publicacion' => 1,
    'publicacion_inicio' => $ahora->modify('-1 hour')->format('Y-m-d H:i:s'),
    'publicacion_fin' => $ahora->modify('+2 hours')->format('Y-m-d H:i:s'),
];
$est4 = ph_estado_publicacion_evento($evHorarioActivo);
afirmar($est4['abierta'] === true && $est4['estado_codigo'] === 'abierta_horario', 'Horario activo dentro del rango permite publicación');

$evHorarioVencido = [
    'nombre_evento' => 'Evento Sistemas Test',
    'publicacion_habilitada' => 1,
    'usar_horario_publicacion' => 1,
    'publicacion_inicio' => $ahora->modify('-5 hours')->format('Y-m-d H:i:s'),
    'publicacion_fin' => $ahora->modify('-1 hour')->format('Y-m-d H:i:s'),
];
$est5 = ph_estado_publicacion_evento($evHorarioVencido);
afirmar($est5['abierta'] === false && $est5['estado_codigo'] === 'horario_vencido', 'Horario vencido bloquea publicación después de la hora final');

$evCerradoAunqueHorarioActivo = [
    'nombre_evento' => 'Evento Sistemas Test',
    'publicacion_habilitada' => 0,
    'usar_horario_publicacion' => 1,
    'publicacion_inicio' => $ahora->modify('-1 hour')->format('Y-m-d H:i:s'),
    'publicacion_fin' => $ahora->modify('+2 hours')->format('Y-m-d H:i:s'),
];
$est6 = ph_estado_publicacion_evento($evCerradoAunqueHorarioActivo);
afirmar($est6['abierta'] === false && $est6['estado_codigo'] === 'cerrada_manual', 'Interruptor manual cerrado prevalece sobre horario activo');

// 3. Prueba de aislamiento en BD entre Sistemas y Civil
$idSistemas = ph_evento_activo($conexion, 'sistemas');
$idCivil = ph_evento_activo($conexion, 'civil');

afirmar($idSistemas > 0, "Evento activo de Ingeniería de Sistemas detectado (ID={$idSistemas})");
afirmar($idCivil > 0, "Evento activo de Ingeniería Civil detectado (ID={$idCivil})");

if ($idSistemas > 0 && $idCivil > 0 && $idSistemas !== $idCivil) {
    // Guardar estado original para restaurar al final
    $origSis = $conexion->query("SELECT publicacion_habilitada, usar_horario_publicacion, publicacion_inicio, publicacion_fin FROM eventos WHERE id_evento = {$idSistemas}")->fetch_assoc();
    $origCiv = $conexion->query("SELECT publicacion_habilitada, usar_horario_publicacion, publicacion_inicio, publicacion_fin FROM eventos WHERE id_evento = {$idCivil}")->fetch_assoc();

    try {
        // Cerrar Sistemas, dejar Civil abierto
        $conexion->query("UPDATE eventos SET publicacion_habilitada = 0, usar_horario_publicacion = 0 WHERE id_evento = {$idSistemas}");
        $conexion->query("UPDATE eventos SET publicacion_habilitada = 1, usar_horario_publicacion = 0 WHERE id_evento = {$idCivil}");

        $verSis = ph_verificar_publicacion_abierta($conexion, $idSistemas);
        $verCiv = ph_verificar_publicacion_abierta($conexion, $idCivil);

        afirmar($verSis['abierta'] === false, 'Cerrar Sistemas bloquea publicación en Sistemas en BD');
        afirmar($verCiv['abierta'] === true, 'Cerrar Sistemas mantiene abierta la publicación en Civil en BD');

        // Configurar horario vencido en Civil y abrir Sistemas
        $iniPasado = $ahora->modify('-4 hours')->format('Y-m-d H:i:s');
        $finPasado = $ahora->modify('-2 hours')->format('Y-m-d H:i:s');
        $stmtCiv = $conexion->prepare("UPDATE eventos SET publicacion_habilitada = 1, usar_horario_publicacion = 1, publicacion_inicio = ?, publicacion_fin = ? WHERE id_evento = ?");
        $stmtCiv->bind_param("ssi", $iniPasado, $finPasado, $idCivil);
        $stmtCiv->execute();
        $stmtCiv->close();

        $conexion->query("UPDATE eventos SET publicacion_habilitada = 1, usar_horario_publicacion = 0 WHERE id_evento = {$idSistemas}");

        $verSis2 = ph_verificar_publicacion_abierta($conexion, $idSistemas);
        $verCiv2 = ph_verificar_publicacion_abierta($conexion, $idCivil);

        afirmar($verSis2['abierta'] === true, 'Sistemas permanece abierto mientras Civil tiene horario vencido');
        afirmar($verCiv2['abierta'] === false && $verCiv2['estado_codigo'] === 'horario_vencido', 'Civil se cierra automáticamente cuando expira su horario');
    } finally {
        // Restaurar valores originales
        $stmtRest = $conexion->prepare("UPDATE eventos SET publicacion_habilitada = ?, usar_horario_publicacion = ?, publicacion_inicio = ?, publicacion_fin = ? WHERE id_evento = ?");
        $hSis = intval($origSis['publicacion_habilitada']);
        $uSis = intval($origSis['usar_horario_publicacion']);
        $iSis = $origSis['publicacion_inicio'];
        $fSis = $origSis['publicacion_fin'];
        $stmtRest->bind_param("iissi", $hSis, $uSis, $iSis, $fSis, $idSistemas);
        $stmtRest->execute();

        $hCiv = intval($origCiv['publicacion_habilitada']);
        $uCiv = intval($origCiv['usar_horario_publicacion']);
        $iCiv = $origCiv['publicacion_inicio'];
        $fCiv = $origCiv['publicacion_fin'];
        $stmtRest->bind_param("iissi", $hCiv, $uCiv, $iCiv, $fCiv, $idCivil);
        $stmtRest->execute();
        $stmtRest->close();
    }
}

echo "\n-----------------------------------------------------------------\n";
echo "Resultado: {$pasaron} pruebas exitosas, {$fallaron} fallidas.\n";
echo "-----------------------------------------------------------------\n";

exit($fallaron > 0 ? 1 : 0);
