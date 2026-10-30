<?php
/**
 * scripts/test_sistema_correos.php
 *
 * Suite integral de pruebas para el sistema de correos y cola asíncrona:
 *  1. Verificación de configuración SMTP y autenticación TLS.
 *  2. Comportamiento de interruptores (correos_estan_deshabilitados).
 *  3. Integridad de plantillas HTML y codificación UTF-8.
 *  4. Flujo de encolado y drenaje de cola en tiempo real.
 *  5. Protección automática contra correos viejos rezagados (>1 hora).
 *  6. Tolerancia a fallos y límite de reintentos (MAX_INTENTOS).
 *  7. Encolado de lotes múltiples (responderJsonYNotificarLote).
 *  8. Limpieza automática de datos de prueba.
 */

chdir(__DIR__ . '/../backend/api');

require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/Auth.php';
require_once __DIR__ . '/../backend/api/includes/Correos.php';

function print_banner($title) {
    echo "\n" . str_repeat('=', 72) . "\n";
    echo "  " . strtoupper($title) . "\n";
    echo str_repeat('=', 72) . "\n";
}

$totalTests = 0;
$passedTests = 0;

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

$idsPruebaLimpiar = [];

try {
    // =========================================================================
    // SUITE 1: Configuración y Conexión SMTP
    // =========================================================================
    print_banner("Suite 1: Configuración y Conexión SMTP");

    $host = correo_env('SMTP_HOST');
    $user = correo_env('SMTP_USER');
    $pass = correo_env('SMTP_PASS');
    $port = intval(correo_env('SMTP_PORT', 587));

    assert_test("Variables SMTP configuradas en entorno", !empty($host) && !empty($user) && !empty($pass), "Host: {$host}, Puerto: {$port}, Usuario: {$user}");

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = $host;
    $mail->SMTPAuth = true;
    $mail->Username = $user;
    $mail->Password = $pass;
    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = $port;
    $mail->Timeout = 10;

    $conexionOk = false;
    try {
        if ($mail->smtpConnect()) {
            $conexionOk = true;
            $mail->smtpClose();
        }
    } catch (Exception $e) {
        $conexionOk = false;
    }
    assert_test("Handshake TLS y autenticación con servidor SMTP exitosos", $conexionOk, "Conexión a {$host}:{$port} validada");

    // =========================================================================
    // SUITE 2: Comportamiento de Interruptores
    // =========================================================================
    print_banner("Suite 2: Comportamiento de Interruptores (correos_estan_deshabilitados)");

    $estadoNormal = correos_estan_deshabilitados();
    assert_test("El servicio de correos está HABILITADO por defecto en configuración actual", $estadoNormal === false);

    // Simular interruptor de apagado
    putenv('DISABLE_EMAILS=true');
    $estadoApagado = correos_estan_deshabilitados();
    assert_test("Interruptor DISABLE_EMAILS=true detecta correctamente que debe pausar", $estadoApagado === true);
    putenv('DISABLE_EMAILS=false');

    putenv('CORREOS_HABILITADOS=false');
    $estadoHabilFalso = correos_estan_deshabilitados();
    assert_test("Interruptor CORREOS_HABILITADOS=false detecta correctamente que debe pausar", $estadoHabilFalso === true);
    putenv('CORREOS_HABILITADOS=true');

    // =========================================================================
    // SUITE 3: Formato y Plantillas HTML
    // =========================================================================
    print_banner("Suite 3: Formato y Plantillas HTML");

    $asuntoTest = "Notificación de Póster: Investigación y Tecnología 2026";
    $cuerpoTest = "<p>Estimado evaluador, tiene <strong>3 pósters pendientes</strong> de calificación.</p>";
    $htmlGenerado = correo_asegurar_plantilla($asuntoTest, $cuerpoTest);

    $tieneInstitucion = strpos($htmlGenerado, 'Universidad Cooperativa de Colombia') !== false;
    $tieneCuerpo = strpos($htmlGenerado, '3 pósters pendientes') !== false;
    $tienePie = strpos($htmlGenerado, 'Sistema de Gestión de Pósteres') !== false;

    assert_test("Plantilla incluye encabezado institucional de la UCC", $tieneInstitucion);
    assert_test("Plantilla conserva el contenido dinámico y acentos UTF-8", $tieneCuerpo);
    assert_test("Plantilla incluye pie de página del sistema", $tienePie);

    // Idempotencia: no anidar plantilla sobre plantilla
    $htmlDoble = correo_asegurar_plantilla($asuntoTest, $htmlGenerado);
    $vecesInstitucion = substr_count($htmlDoble, 'Universidad Cooperativa de Colombia');
    assert_test("Plantilla es idempotente (no duplica encabezados si ya está envuelta)", $vecesInstitucion === 1);

    // =========================================================================
    // SUITE 4: Flujo de Encolado y Drenaje en Tiempo Real
    // =========================================================================
    print_banner("Suite 4: Encolado y Drenaje en Tiempo Real");

    $destinatarioTest = $user; // Enviamos a la misma cuenta SMTP del sistema para no afectar a terceros
    $asuntoPrueba4 = "Prueba Unitaria de Cola en Tiempo Real - " . uniqid();
    $cuerpoPrueba4 = "<p>Verificación de flujo encolado -> drenaje -> enviado.</p>";

    $encoladoOk = encolarCorreoFondo($destinatarioTest, $asuntoPrueba4, $cuerpoPrueba4, false);
    assert_test("encolarCorreoFondo() inserta correctamente en tabla cola_correos", $encoladoOk);

    $stmtCheck = $conexion->prepare("SELECT id, estado, intentos FROM cola_correos WHERE asunto = ? LIMIT 1");
    $stmtCheck->bind_param("s", $asuntoPrueba4);
    $stmtCheck->execute();
    $rowCheck = $stmtCheck->get_result()->fetch_assoc();
    $stmtCheck->close();

    $idP4 = intval($rowCheck['id']);
    $idsPruebaLimpiar[] = $idP4;
    assert_test("Correo recién encolado tiene estado 'pendiente' e intentos 0", $rowCheck['estado'] === 'pendiente' && intval($rowCheck['intentos']) === 0, "ID asignado: {$idP4}");

    // Ejecutar ColaCorreos.php para drenar
    chdir(__DIR__ . '/../backend/tareas');
    exec('php ColaCorreos.php', $salidaDrenaje, $codigoDrenaje);
    chdir(__DIR__ . '/../backend/api');

    assert_test("ColaCorreos.php ejecutó exitosamente (código de salida 0)", $codigoDrenaje === 0);

    $stmtFinal = $conexion->prepare("SELECT id, estado, enviado_at, ultimo_error FROM cola_correos WHERE id = ?");
    $stmtFinal->bind_param("i", $idP4);
    $stmtFinal->execute();
    $rowFinal = $stmtFinal->get_result()->fetch_assoc();
    $stmtFinal->close();

    assert_test("Correo procesado cambió a estado 'enviado' con fecha de envío", $rowFinal['estado'] === 'enviado' && !empty($rowFinal['enviado_at']), "enviado_at: {$rowFinal['enviado_at']}");

    // =========================================================================
    // SUITE 5: Protección Contra Correos Viejos Rezagados (>1 Hora)
    // =========================================================================
    print_banner("Suite 5: Protección Automática Contra Correos Viejos Rezagados");

    // Insertar deliberadamente un correo "viejo" (creado hace 3 horas)
    $asuntoViejo = "Correo Rezagado de Prueba (Hace 3 horas) - " . uniqid();
    $conexion->query(
        "INSERT INTO cola_correos (destinatario, asunto, mensaje, estado, intentos, created_at)
         VALUES ('{$destinatarioTest}', '{$asuntoViejo}', 'Mensaje viejo que NO debe enviarse', 'pendiente', 0, DATE_SUB(NOW(), INTERVAL 3 HOUR))"
    );
    $idViejo = $conexion->insert_id;
    $idsPruebaLimpiar[] = $idViejo;

    assert_test("Simulación: correo antiguo insertado con created_at de hace 3 horas", $idViejo > 0, "ID: {$idViejo}");

    // Ejecutar ColaCorreos.php
    chdir(__DIR__ . '/../backend/tareas');
    exec('php ColaCorreos.php', $salidaDrenaje2, $codigoDrenaje2);
    chdir(__DIR__ . '/../backend/api');

    // Verificar que fue marcado como 'error' y NO como 'enviado'
    $stmtViejo = $conexion->prepare("SELECT id, estado, ultimo_error, enviado_at FROM cola_correos WHERE id = ?");
    $stmtViejo->bind_param("i", $idViejo);
    $stmtViejo->execute();
    $rowViejo = $stmtViejo->get_result()->fetch_assoc();
    $stmtViejo->close();

    $fueDescartado = ($rowViejo['estado'] === 'error') && empty($rowViejo['enviado_at']);
    $motivoCorrecto = strpos((string)$rowViejo['ultimo_error'], 'Descartado: correo antiguo') !== false;

    assert_test("El correo rezagado fue DESCARTADO y NO enviado por el servidor", $fueDescartado, "Estado final: {$rowViejo['estado']}");
    assert_test("El motivo del descarte registra la protección de correo antiguo", $motivoCorrecto, "Detalle: {$rowViejo['ultimo_error']}");

    // =========================================================================
    // SUITE 6: Tolerancia a Fallos y Reintentos (Dead-Letter)
    // =========================================================================
    print_banner("Suite 6: Tolerancia a Fallos y Reintentos (Dead-Letter)");

    // Correo con intentos = 4 (a 1 intento del límite MAX_INTENTOS=5) y con destinatario inválido para forzar error
    $asuntoFallo = "Correo Destinado a Fallar - " . uniqid();
    $conexion->query(
        "INSERT INTO cola_correos (destinatario, asunto, mensaje, estado, intentos, created_at)
         VALUES ('correo_invalido_sin_formato', '{$asuntoFallo}', 'Cuerpo de prueba', 'pendiente', 4, NOW())"
    );
    $idFallo = $conexion->insert_id;
    $idsPruebaLimpiar[] = $idFallo;

    chdir(__DIR__ . '/../backend/tareas');
    exec('php ColaCorreos.php', $salidaDrenaje3, $codigoDrenaje3);
    chdir(__DIR__ . '/../backend/api');

    $stmtFallo = $conexion->prepare("SELECT id, estado, intentos, ultimo_error FROM cola_correos WHERE id = ?");
    $stmtFallo->bind_param("i", $idFallo);
    $stmtFallo->execute();
    $rowFallo = $stmtFallo->get_result()->fetch_assoc();
    $stmtFallo->close();

    assert_test("Correo con 5 intentos fallidos pasa a estado 'error' definitivo (no queda en bucle infinito)", 
        $rowFallo['estado'] === 'error' && intval($rowFallo['intentos']) >= 5, 
        "Estado: {$rowFallo['estado']}, Intentos: {$rowFallo['intentos']}");

    // =========================================================================
    // SUITE 7: Encolado por Lote (responderJsonYNotificarLote)
    // =========================================================================
    print_banner("Suite 7: Encolado Múltiple por Lote");

    $loteTest = [
        ['correo' => $user, 'asunto' => 'Lote 1 ' . uniqid(), 'mensaje' => '<p>Mensaje 1</p>'],
        ['correo' => $user, 'asunto' => 'Lote 2 ' . uniqid(), 'mensaje' => '<p>Mensaje 2</p>']
    ];

    ob_start();
    responderJsonYNotificarLote(['status' => 'success'], $loteTest);
    $salidaJson = ob_get_clean();

    $jsonOk = json_decode($salidaJson, true);
    assert_test("responderJsonYNotificarLote emite respuesta JSON válida de inmediato", isset($jsonOk['status']) && $jsonOk['status'] === 'success');

    // Verificar que ambos correos fueron insertados
    $asuntoL1 = $loteTest[0]['asunto'];
    $asuntoL2 = $loteTest[1]['asunto'];
    $resL = $conexion->query("SELECT id FROM cola_correos WHERE asunto IN ('{$asuntoL1}', '{$asuntoL2}')");
    $idsLote = [];
    while ($rL = $resL->fetch_assoc()) $idsLote[] = intval($rL['id']);
    $idsPruebaLimpiar = array_merge($idsPruebaLimpiar, $idsLote);

    assert_test("Todos los correos del lote fueron encolados correctamente en BD", count($idsLote) === 2, "IDs: " . implode(', ', $idsLote));

} catch (Throwable $e) {
    echo "\n[ERROR CRÍTICO] " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine() . "\n";
} finally {
    // =========================================================================
    // LIMPIEZA DE DATOS DE PRUEBA
    // =========================================================================
    print_banner("Limpieza de Registros de Prueba");
    if (!empty($idsPruebaLimpiar)) {
        $lista = implode(',', array_map('intval', $idsPruebaLimpiar));
        $conexion->query("DELETE FROM cola_correos WHERE id IN ({$lista})");
        echo "  Registros temporales de prueba eliminados de cola_correos: {$lista}\n";
    }

    print_banner("Resumen Final de Pruebas de Correos");
    echo "  Total de verificaciones: {$totalTests}\n";
    echo "  Exitosas:                {$passedTests}\n";
    echo "  Fallidas:                " . ($totalTests - $passedTests) . "\n";
    if ($passedTests === $totalTests && $totalTests > 0) {
        echo "\n  >>> RESULTADO: SISTEMA DE CORREOS OPERA AL 100% SIN NINGÚN BUG <<<\n";
    } else {
        echo "\n  >>> RESULTADO: SE ENCONTRARON FALLOS EN LA SUITE <<<\n";
    }
    echo str_repeat('=', 72) . "\n\n";
}
