<?php
// backend/api/ImportarUsuarios.php
// Importación masiva de usuarios desde CSV (Admin de carrera rol 3 y Super Admin rol 4).
//
// POST (JSON): { "csv": "nombres,apellidos,correo,carrera,rol\n..." }
// o multipart con campo `archivo` (.csv).
//
// Columnas (por encabezado, orden libre):
//   nombres*, apellidos*, correo*, carrera*, rol?, id_evento?
// rol: usuario|1, evaluador|2, admin|3  (NUNCA 4; admin solo permitido si importa Super Admin)
//
// Contraseña temporal: aleatoria generada y enviada por correo a cada usuario importado.

require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/RondasHelper.php';

$auth = require_role([3, 4]);
$rolActor = intval($auth['rol'] ?? 0);
$esAdminCarrera = ($rolActor === 3);
$carreraAdmin = $esAdminCarrera ? auth_carrera_admin($conexion, $auth) : null;
$idEventoAdmin = $esAdminCarrera ? auth_id_evento_admin($conexion, $auth) : null;

function imp_parsear_rol($v)
{
    $s = mb_strtolower(trim((string)$v), 'UTF-8');
    if ($s === '' || $s === 'usuario' || $s === '1') return 1;
    if ($s === 'evaluador' || $s === '2') return 2;
    if ($s === 'admin' || $s === 'administrador' || $s === '3') return 3;
    return 0;
}

function imp_etiqueta_rol($rol)
{
    switch (intval($rol)) {
        case 2: return 'Evaluador';
        case 3: return 'Administrador';
        default: return 'Estudiante / Autor';
    }
}

function imp_normalizar_carrera($v)
{
    $c = mb_strtolower(trim((string)$v), 'UTF-8');
    if (strpos($c, 'civil') !== false) return 'civil';
    if (strpos($c, 'admin') !== false) return 'administracion';
    if (strpos($c, 'derecho') !== false) return 'derecho';
    return 'sistemas';
}

function imp_generar_password_aleatoria()
{
    $fija = app_env('PASS_TEMPORAL_IMPORT');
    if ($fija !== null && $fija !== '') {
        return $fija;
    }
    $abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $rand = '';
    $len = strlen($abc);
    for ($i = 0; $i < 6; $i++) {
        $rand .= $abc[random_int(0, $len - 1)];
    }
    return 'Ucc-' . $rand;
}

function imp_evento_activo_por_carrera($conexion, $carrera)
{
    $cNorm = (strpos(mb_strtolower((string)$carrera, 'UTF-8'), 'civil') !== false) ? 'civil' : 'sistemas';
    $stmt = $conexion->prepare("SELECT id_evento FROM eventos WHERE activo = 1 AND (carrera = ? OR carrera = 'ambas') ORDER BY (carrera = ?) DESC, id_evento ASC LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ss", $cNorm, $cNorm);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($row && !empty($row['id_evento'])) {
            return intval($row['id_evento']);
        }
    }
    return null;
}

function imp_construir_correo_bienvenida($nombreCompleto, $correo, $passwordGenerada, $rol, $carrera)
{
    $nomEsc = rh_escapar($nombreCompleto);
    $corEsc = rh_escapar($correo);
    $passEsc = rh_escapar($passwordGenerada);
    $rolEsc = rh_escapar(imp_etiqueta_rol($rol));
    $carreraLabel = (strpos(mb_strtolower((string)$carrera, 'UTF-8'), 'civil') !== false)
        ? 'Ingeniería Civil'
        : 'Ingeniería de Sistemas';

    $asunto = 'Bienvenido(a) a Pósters UCC - Tu contraseña de acceso';
    $cuerpoInterno = "
        <p>Hola, <strong>{$nomEsc}</strong>.</p>
        <p>Tu cuenta ha sido registrada en la plataforma de <strong>Gestión y Evaluación de Pósters Científicos UCC ({$carreraLabel})</strong> con el rol de <strong>{$rolEsc}</strong>.</p>
        <div style='margin:16px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #007B99;border-radius:6px;color:#1e293b;'>
            <p style='margin:0 0 8px;'><strong>🔑 Tus credenciales de acceso son:</strong></p>
            <p style='margin:4px 0;'><strong>Correo electrónico:</strong> {$corEsc}</p>
            <p style='margin:4px 0;'><strong>Contraseña generada:</strong> <code style='font-size:15px;padding:3px 8px;background:#e0f4f8;color:#005f73;border-radius:4px;font-weight:700;'>{$passEsc}</code></p>
        </div>
        <div style='margin:16px 0;padding:12px 14px;background:#fff8e6;border-left:4px solid #d97706;border-radius:6px;color:#78350f;'>
            <p style='margin:0;font-weight:700;'>⚠️ Importante por tu seguridad:</p>
            <p style='margin:6px 0 0;font-size:13.5px;line-height:1.5;'>
                Esta contraseña ha sido generada de forma aleatoria para tu primer ingreso. Te recomendamos encarecidamente iniciar sesión lo antes posible, dirigirte al apartado <strong>&laquo;Mi Cuenta&raquo;</strong> y <strong>cambiar tu contraseña por una personal y segura</strong> para evitar cualquier inconveniente o riesgo de seguridad.
            </p>
        </div>
    ";

    return [
        'asunto' => $asunto,
        'cuerpo' => rh_plantilla_correo('Credenciales de acceso - Pósters UCC', $cuerpoInterno),
    ];
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

$passTempGlobal = imp_generar_password_aleatoria();

$creados = 0;
$omitidos = 0;
$errores = [];
$correosVistos = [];
$loteCorreos = [];

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
    $carreraCsv = $get('carrera');
    $carrera = imp_normalizar_carrera($carreraCsv);
    $rol = $mapa['rol'] !== false ? imp_parsear_rol($get('rol')) : 1;
    $idEvento = $mapa['id_evento'] !== false ? intval($get('id_evento')) : 0;

    if ($nombres === '' || $apellidos === '' || $correo === '' || ($carreraCsv === '' && !$esAdminCarrera)) {
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
    if ($esAdminCarrera && $rol === 3) {
        $errores[] = ['fila' => $numFila, 'motivo' => 'Solo el Super Admin puede crear cuentas con rol Administrador.'];
        continue;
    }

    // Si quien importa es un Admin de carrera, el usuario queda asociado a su carrera y evento
    if ($esAdminCarrera) {
        $carrera = ($carreraAdmin === 'civil') ? 'civil' : 'sistemas';
        $idEvento = $idEventoAdmin ? intval($idEventoAdmin) : intval(imp_evento_activo_por_carrera($conexion, $carrera) ?? 0);
    } elseif ($idEvento <= 0) {
        $idEvento = intval(imp_evento_activo_por_carrera($conexion, $carrera) ?? 0);
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

    // Generar contraseña aleatoria y hash para el usuario importado
    $passUsuario = imp_generar_password_aleatoria();
    $passTempGlobal = $passUsuario;
    $hashUsuario = password_hash($passUsuario, PASSWORD_DEFAULT);

    // Importados: activos de inmediato (el admin/superadmin ya los validó).
    $activo = 1;
    $desactivado = 0;
    if ($idEvento > 0) {
        $stmtIns = $conexion->prepare(
            "INSERT INTO usuario (nombres, apellidos, correo, `contraseña`, carrera, id_rol, activo, id_evento, desactivado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtIns->bind_param("sssssiisi", $nombres, $apellidos, $correo, $hashUsuario, $carrera, $rol, $activo, $idEvento, $desactivado);
    } else {
        $stmtIns = $conexion->prepare(
            "INSERT INTO usuario (nombres, apellidos, correo, `contraseña`, carrera, id_rol, activo, desactivado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtIns->bind_param("sssssiis", $nombres, $apellidos, $correo, $hashUsuario, $carrera, $rol, $activo, $desactivado);
    }

    if ($stmtIns && $stmtIns->execute()) {
        $creados++;
        $stmtIns->close();

        $mailInfo = imp_construir_correo_bienvenida(trim($nombres . ' ' . $apellidos), $correo, $passUsuario, $rol, $carrera);
        $loteCorreos[] = [
            'correo' => $correo,
            'asunto' => $mailInfo['asunto'],
            'cuerpo' => $mailInfo['cuerpo'],
        ];
    } else {
        $detalle = $stmtIns ? $stmtIns->error : 'prepare falló';
        if ($stmtIns) $stmtIns->close();
        error_log("ImportarUsuarios fila {$numFila}: {$detalle}");
        $errores[] = ['fila' => $numFila, 'motivo' => 'No se pudo guardar la fila.'];
    }
}

$respuesta = [
    'success' => true,
    'message' => "Importación finalizada: {$creados} creados, {$omitidos} omitidos.",
    'creados' => $creados,
    'omitidos' => $omitidos,
    'correos_enviados' => count($loteCorreos),
    'errores' => $errores,
    'password_temporal' => $creados > 0 ? $passTempGlobal : null,
];

responderJsonYNotificarLote($respuesta, $loteCorreos);
exit;
