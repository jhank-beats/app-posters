<?php
// backend/api/ImportarUsuarios.php
// Importación masiva de usuarios desde CSV (solo Super Admin, rol 4).
//
// POST (JSON): { "csv": "nombres,apellidos,correo,carrera,rol\n..." }
// o multipart con campo `archivo` (.csv).
//
// Columnas (por encabezado, orden libre):
//   nombres*, apellidos*, correo*, carrera*, rol?, id_evento?
// rol: usuario|1, evaluador|2, admin|3  (NUNCA 4)
//
// Contraseña temporal: env PASS_TEMPORAL_IMPORT o por defecto Ucc*2026.

require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';

$auth = require_role([4]);

function imp_parsear_rol($v)
{
    $s = mb_strtolower(trim((string)$v), 'UTF-8');
    if ($s === '' || $s === 'usuario' || $s === '1') return 1;
    if ($s === 'evaluador' || $s === '2') return 2;
    if ($s === 'admin' || $s === 'administrador' || $s === '3') return 3;
    return 0;
}

function imp_normalizar_carrera($v)
{
    $c = mb_strtolower(trim((string)$v), 'UTF-8');
    if (strpos($c, 'civil') !== false) return 'civil';
    if (strpos($c, 'admin') !== false) return 'administracion';
    if (strpos($c, 'derecho') !== false) return 'derecho';
    return 'sistemas';
}

// --- Obtener texto CSV ---
$csvTexto = null;
if (!empty($_FILES['archivo']['tmp_name']) && is_uploaded_file($_FILES['archivo']['tmp_name'])) {
    $csvTexto = (string)file_get_contents($_FILES['archivo']['tmp_name']);
} else {
    $raw = file_get_contents('php://input');
    $j = json_decode($raw, true);
    if (is_array($j) && isset($j['csv'])) {
        $csvTexto = (string)$j['csv'];
    }
}

if ($csvTexto === null || trim($csvTexto) === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No se recibió ningún CSV.']);
    exit;
}

// Normalizar BOM y saltos de línea
if (strncmp($csvTexto, "\xEF\xBB\xBF", 3) === 0) {
    $csvTexto = substr($csvTexto, 3);
}
$csvTexto = str_replace(["\r\n", "\r"], "\n", $csvTexto);
$lineas = explode("\n", $csvTexto);
$lineas = array_values(array_filter($lineas, function ($l) {
    return trim($l) !== '';
}));

if (count($lineas) < 2) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El CSV debe incluir encabezados y al menos una fila de datos.']);
    exit;
}

$MAX_FILAS = 500;
$encabezado = array_map('mb_strtolower', str_getcsv(array_shift($lineas)));
$mapa = [];
foreach (['nombres', 'apellidos', 'correo', 'carrera', 'rol', 'id_evento'] as $col) {
    $mapa[$col] = array_search($col, $encabezado, true);
}

$faltan = [];
foreach (['nombres', 'apellidos', 'correo', 'carrera'] as $oblig) {
    if ($mapa[$oblig] === false) $faltan[] = $oblig;
}
if ($faltan) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Faltan columnas obligatorias en el encabezado: ' . implode(', ', $faltan),
    ]);
    exit;
}

if (count($lineas) > $MAX_FILAS) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "Máximo {$MAX_FILAS} filas por importación."]);
    exit;
}

$passTemp = app_env('PASS_TEMPORAL_IMPORT', 'Ucc*2026');
$hashTemp = password_hash($passTemp, PASSWORD_DEFAULT);

$creados = 0;
$omitidos = 0;
$errores = [];
$correosVistos = [];

foreach ($lineas as $i => $linea) {
    $numFila = $i + 2; // +2: encabezado es la 1 y array_shift ya la quitó
    $campos = str_getcsv($linea);
    if (count($campos) === 1 && trim((string)$campos[0]) === '') continue;

    $get = function ($col) use ($campos, $mapa) {
        $idx = $mapa[$col];
        return ($idx === false || !isset($campos[$idx])) ? '' : trim((string)$campos[$idx]);
    };

    $nombres = $get('nombres');
    $apellidos = $get('apellidos');
    $correo = mb_strtolower($get('correo'), 'UTF-8');
    $carrera = imp_normalizar_carrera($get('carrera'));
    $rol = $mapa['rol'] !== false ? imp_parsear_rol($get('rol')) : 1;
    $idEvento = $mapa['id_evento'] !== false ? intval($get('id_evento')) : 0;

    if ($nombres === '' || $apellidos === '' || $correo === '' || $get('carrera') === '') {
        $errores[] = ['fila' => $numFila, 'motivo' => 'Faltan nombres, apellidos, correo o carrera.'];
        continue;
    }
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        $errores[] = ['fila' => $numFila, 'motivo' => "Correo inválido: {$correo}"];
        continue;
    }
    if ($rol < 1 || $rol > 3) {
        $errores[] = ['fila' => $numFila, 'motivo' => 'Rol inválido (usa usuario, evaluador o admin). No se permite superadmin.'];
        continue;
    }

    if (isset($correosVistos[$correo])) {
        $omitidos++;
        $errores[] = ['fila' => $numFila, 'motivo' => 'Correo duplicado dentro del archivo.'];
        continue;
    }
    $correosVistos[$correo] = true;

    $stmt = $conexion->prepare("SELECT id FROM usuario WHERE correo = ? LIMIT 1");
    $stmt->bind_param("s", $correo);
    $stmt->execute();
    $existe = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($existe) {
        $omitidos++;
        $errores[] = ['fila' => $numFila, 'motivo' => 'El correo ya existe en la plataforma.'];
        continue;
    }

    // Importados: activos de inmediato (el superadmin ya los validó).
    $activo = 1;
    $desactivado = 0;
    if ($idEvento > 0 && $rol === 3) {
        $stmtIns = $conexion->prepare(
            "INSERT INTO usuario (nombres, apellidos, correo, `contraseña`, carrera, id_rol, activo, id_evento, desactivado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtIns->bind_param("sssssiisi", $nombres, $apellidos, $correo, $hashTemp, $carrera, $rol, $activo, $idEvento, $desactivado);
    } else {
        $stmtIns = $conexion->prepare(
            "INSERT INTO usuario (nombres, apellidos, correo, `contraseña`, carrera, id_rol, activo, desactivado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtIns->bind_param("sssssiis", $nombres, $apellidos, $correo, $hashTemp, $carrera, $rol, $activo, $desactivado);
    }

    if ($stmtIns && $stmtIns->execute()) {
        $creados++;
        $stmtIns->close();
    } else {
        $detalle = $stmtIns ? $stmtIns->error : 'prepare falló';
        if ($stmtIns) $stmtIns->close();
        $errores[] = ['fila' => $numFila, 'motivo' => "No se pudo guardar: {$detalle}"];
    }
}

echo json_encode([
    'success' => true,
    'message' => "Importación finalizada: {$creados} creados, {$omitidos} omitidos.",
    'creados' => $creados,
    'omitidos' => $omitidos,
    'errores' => $errores,
    'password_temporal' => $passTemp,
]);
exit;
