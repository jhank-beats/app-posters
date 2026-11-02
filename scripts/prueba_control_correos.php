<?php
/**
 * Suite de pruebas para Control de Correos por Carrera y Global
 */
require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/Correos.php';
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
echo " PRUEBAS: CONTROL DE CORREOS GLOBAL Y POR CARRERA\n";
echo "=================================================================\n\n";

// 1. Asegurar tablas y columnas
correos_asegurar_tablas_y_columnas($conexion);

$resTabla = $conexion->query("SHOW TABLES LIKE 'configuracion_sistema'");
afirmar($resTabla && $resTabla->num_rows > 0, "Tabla configuracion_sistema existe");

$resColEv = $conexion->query("SHOW COLUMNS FROM eventos LIKE 'correos_habilitados'");
afirmar($resColEv && $resColEv->num_rows > 0, "Columna correos_habilitados existe en tabla eventos");

$resColCola = $conexion->query("SHOW COLUMNS FROM cola_correos LIKE 'carrera'");
afirmar($resColCola && $resColCola->num_rows > 0, "Columna carrera existe en cola_correos");

// 2. Pruebas de interrupción global
$idSistemas = ph_evento_activo($conexion, 'sistemas');
$idCivil = ph_evento_activo($conexion, 'civil');

afirmar($idSistemas > 0, "Evento activo Sistemas (ID={$idSistemas})");
afirmar($idCivil > 0, "Evento activo Civil (ID={$idCivil})");

// Guardar estados originales
$origGlobal = correos_global_habilitados($conexion);
$origSis = correos_carrera_habilitados('sistemas', $conexion);
$origCiv = correos_carrera_habilitados('civil', $conexion);

try {
    // 2.1 Poner global en 1, sistemas en 1, civil en 1 -> todo habilitado
    $conexion->query("UPDATE configuracion_sistema SET valor = '1' WHERE clave = 'correos_global_habilitados'");
    $conexion->query("UPDATE eventos SET correos_habilitados = 1 WHERE id_evento IN ({$idSistemas}, {$idCivil})");

    afirmar(correos_estan_deshabilitados() === false, "Sin filtros: correos habilitados globalmente");
    afirmar(correos_estan_deshabilitados('sistemas') === false, "Sistemas: correos habilitados");
    afirmar(correos_estan_deshabilitados('civil') === false, "Civil: correos habilitados");

    // 2.2 Pausar globalmente
    $conexion->query("UPDATE configuracion_sistema SET valor = '0' WHERE clave = 'correos_global_habilitados'");
    afirmar(correos_estan_deshabilitados() === true, "Global=0: correos deshabilitados globalmente");
    afirmar(correos_estan_deshabilitados('sistemas') === true, "Global=0: bloquea correos de Sistemas");
    afirmar(correos_estan_deshabilitados('civil') === true, "Global=0: bloquea correos de Civil");

    // 2.3 Reactivar global, pero pausar Civil únicamente
    $conexion->query("UPDATE configuracion_sistema SET valor = '1' WHERE clave = 'correos_global_habilitados'");
    $conexion->query("UPDATE eventos SET correos_habilitados = 0 WHERE id_evento = {$idCivil}");
    $conexion->query("UPDATE eventos SET correos_habilitados = 1 WHERE id_evento = {$idSistemas}");

    afirmar(correos_estan_deshabilitados() === false, "Global=1: en general habilitado");
    afirmar(correos_estan_deshabilitados('sistemas') === false, "Sistemas permanece habilitado");
    afirmar(correos_estan_deshabilitados('civil') === true, "Civil queda pausado independientemente");
    afirmar(correos_estan_deshabilitados(null, $idCivil) === true, "Civil por id_evento queda pausado");

    // 2.4 Pausar Sistemas, reactivar Civil
    $conexion->query("UPDATE eventos SET correos_habilitados = 1 WHERE id_evento = {$idCivil}");
    $conexion->query("UPDATE eventos SET correos_habilitados = 0 WHERE id_evento = {$idSistemas}");

    afirmar(correos_estan_deshabilitados('sistemas') === true, "Sistemas queda pausado");
    afirmar(correos_estan_deshabilitados('civil') === false, "Civil queda habilitado");

} finally {
    // Restaurar
    $conexion->query("UPDATE configuracion_sistema SET valor = '" . ($origGlobal ? '1' : '0') . "' WHERE clave = 'correos_global_habilitados'");
    $conexion->query("UPDATE eventos SET correos_habilitados = " . ($origSis ? '1' : '0') . " WHERE id_evento = {$idSistemas}");
    $conexion->query("UPDATE eventos SET correos_habilitados = " . ($origCiv ? '1' : '0') . " WHERE id_evento = {$idCivil}");
}

echo "\n-----------------------------------------------------------------\n";
echo "Resultado: {$pasaron} pruebas exitosas, {$fallaron} fallidas.\n";
echo "-----------------------------------------------------------------\n";

exit($fallaron > 0 ? 1 : 0);
