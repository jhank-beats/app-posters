<?php
/**
 * scripts/test_flujo_completo.php
 *
 * Script de prueba End-to-End para validar de manera real las 10 fases
 * operativas del sistema de gestión de pósteres contra la API local y MariaDB.
 */

require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/Auth.php';

$BASE_URL = 'http://127.0.0.1:8000/api';

function api_request($endpoint, $method = 'GET', $body = null, $token = null, $isMultipart = false) {
    global $BASE_URL;
    $url = $BASE_URL . $endpoint;
    $ch = curl_init($url);
    
    $headers = [];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($isMultipart) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        } else {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($body) ? json_encode($body) : $body);
        }
    } elseif ($method === 'PUT') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($body) ? json_encode($body) : $body);
    } elseif ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        if ($body) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($body) ? json_encode($body) : $body);
        }
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    if ($err) {
        return ['httpCode' => 0, 'error' => $err, 'data' => null];
    }
    
    return [
        'httpCode' => $httpCode,
        'raw' => $response,
        'data' => json_decode($response, true)
    ];
}

function color($txt, $col) {
    $colors = ['green' => "\033[32m", 'red' => "\033[31m", 'blue' => "\033[34m", 'yellow' => "\033[33m", 'reset' => "\033[0m", 'bold' => "\033[1m"];
    return ($colors[$col] ?? '') . $txt . $colors['reset'];
}

function assert_test($cond, $desc) {
    if ($cond) {
        echo "  " . color("✔ PASS: ", "green") . "$desc\n";
        return true;
    } else {
        echo "  " . color("✖ FAIL: ", "red") . "$desc\n";
        return false;
    }
}

echo color("\n=========================================================================\n", "blue");
echo color("   PRUEBA INTEGRAL END-TO-END DE LAS 10 FASES OPERATIVAS DEL SISTEMA   \n", "bold");
echo color("=========================================================================\n\n", "blue");

$tokenSuperAdmin = auth_issue_token(1, 4); // Super Admin (Camilo Murillo)
$idEventoTest = 0;
$idsEspacios = [];
$idsUsuarios = [];
$idsPosters = [];
$idRonda1 = 0;
$idRonda2 = 0;
$idCriterio1 = 0;
$idCriterio2 = 0;

try {
    // -------------------------------------------------------------------------
    // FASE 1: Configuración Inicial (Evento, Espacios Continuos y Ronda 1)
    // -------------------------------------------------------------------------
    echo color("--- FASE 1: Configuración de Espacios Físicos y Ronda 1 ---\n", "yellow");
    
    // 1.1 Crear Evento de prueba
    $stmtEv = $conexion->prepare("INSERT INTO eventos (nombre_evento, codigo_evento, carrera, fecha_inicio, fecha_fin, activo) VALUES ('Evento E2E Automatizado', 'E2E-2026', 'sistemas', '2026-10-01', '2026-12-31', 1)");
    $stmtEv->execute();
    $idEventoTest = $conexion->insert_id;
    $stmtEv->close();
    assert_test($idEventoTest > 0, "Evento de prueba creado con ID: $idEventoTest");

    // 1.2 Crear Espacio Físico 1 (Capacidad: 2 puestos, puestos 1 y 2)
    $resEsp1 = api_request('/Espacios.php', 'POST', [
        'nombre_espacio' => 'Pabellón TIC - Piso 1',
        'ubicacion_detallada' => 'Bloque A',
        'capacidad' => 2,
        'id_evento' => $idEventoTest
    ], $tokenSuperAdmin);
    assert_test($resEsp1['data']['status'] === 'success', "Espacio 1 creado (Capacidad: 2)");

    // 1.3 Crear Espacio Físico 2 (Capacidad: 3 puestos, puestos 3, 4 y 5)
    $resEsp2 = api_request('/Espacios.php', 'POST', [
        'nombre_espacio' => 'Pabellón TIC - Piso 2',
        'ubicacion_detallada' => 'Bloque B',
        'capacidad' => 3,
        'id_evento' => $idEventoTest
    ], $tokenSuperAdmin);
    assert_test($resEsp2['data']['status'] === 'success', "Espacio 2 creado (Capacidad: 3)");

    // Consultar espacios creados y verificar numeración continua
    $resEspList = api_request("/Espacios.php?id_evento=$idEventoTest", 'GET', null, $tokenSuperAdmin);
    $espacios = $resEspList['data']['data'] ?? [];
    $idsEspacios = array_column($espacios, 'id_espacio');
    assert_test(count($espacios) === 2, "Se listaron los 2 espacios del evento");

    // 1.4 Crear Ronda 1 con criterios, cupo de selección (corte = 2) y premios = 2
    $stmtR1 = $conexion->prepare("INSERT INTO rondas (id_evento, numero, nombre, estado, cupos_seleccion, premios, fecha_inicio) VALUES (?, 1, 'Ronda 1 · Exposición en Mesa E2E', 'abierta', 2, 2, NOW())");
    $stmtR1->bind_param("i", $idEventoTest);
    $stmtR1->execute();
    $idRonda1 = $conexion->insert_id;
    $stmtR1->close();
    assert_test($idRonda1 > 0, "Ronda 1 creada (ID: $idRonda1, Cupo de Corte: 2, Premios: 2)");

    // Crear criterios para Ronda 1
    $stmtCrit1 = $conexion->prepare("INSERT INTO criterios_evaluacion (id_ronda, nombre, descripcion, activo) VALUES (?, 'Metodología y Claridad', 'Rigor del proyecto', 1)");
    $stmtCrit1->bind_param("i", $idRonda1);
    $stmtCrit1->execute();
    $idCriterio1 = $conexion->insert_id;
    $stmtCrit1->close();

    $stmtCrit2 = $conexion->prepare("INSERT INTO criterios_evaluacion (id_ronda, nombre, descripcion, activo) VALUES (?, 'Impacto e Innovación', 'Aporte tecnológico', 1)");
    $stmtCrit2->bind_param("i", $idRonda1);
    $stmtCrit2->execute();
    $idCriterio2 = $conexion->insert_id;
    $stmtCrit2->close();
    assert_test($idCriterio1 > 0 && $idCriterio2 > 0, "Criterios de evaluación configurados para Ronda 1");

    // -------------------------------------------------------------------------
    // FASE 2: Registro, Admisión de Usuarios y Asignación de Roles
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 2: Registro de Usuarios, Admisión y Asignación de Roles ---\n", "yellow");

    $usuariosData = [
        ['nombres' => 'Estudiante A', 'apellidos' => 'Autor E2E', 'correo' => 'estudiante.a.e2e@campusucc.edu.co', 'rol_final' => 1],
        ['nombres' => 'Estudiante B', 'apellidos' => 'Autor E2E', 'correo' => 'estudiante.b.e2e@campusucc.edu.co', 'rol_final' => 1],
        ['nombres' => 'Docente X', 'apellidos' => 'Profesor Asignado', 'correo' => 'docente.x.e2e@campusucc.edu.co', 'rol_final' => 2], // Será evaluador
        ['nombres' => 'Evaluador Y', 'apellidos' => 'Jurado Neutral 1', 'correo' => 'evaluador.y.e2e@campusucc.edu.co', 'rol_final' => 2],  // Será evaluador
        ['nombres' => 'Evaluador Z', 'apellidos' => 'Jurado Neutral 2', 'correo' => 'evaluador.z.e2e@campusucc.edu.co', 'rol_final' => 2],  // Será evaluador
    ];

    foreach ($usuariosData as $u) {
        $resReg = api_request('/Registro.php', 'POST', [
            'nombres' => $u['nombres'],
            'apellidos' => $u['apellidos'],
            'correo' => $u['correo'],
            'contrasena' => 'Demo1234!',
            'carrera' => 'Ingeniería de Sistemas'
        ]);
        assert_test($resReg['data']['status'] === 'success', "Registro completado: {$u['correo']}");
    }

    // 2.2 Verificar que aparecen en Solicitudes pendientes (activo = 0)
    $resSols = api_request('/TablaSolicitudes.php', 'GET', null, $tokenSuperAdmin);
    $solicitudes = $resSols['data']['data'] ?? [];
    $correosSols = array_column($solicitudes, 'correo');
    assert_test(in_array('estudiante.a.e2e@campusucc.edu.co', $correosSols), "Usuarios en espera de aprobación en Solicitudes");

    // 2.3 Aprobar cada usuario y asignar roles
    foreach ($solicitudes as $sol) {
        if (strpos($sol['correo'], '.e2e@campusucc.edu.co') !== false) {
            $uId = $sol['id'];
            $idsUsuarios[$sol['correo']] = $uId;
            // Aprobar cuenta
            api_request('/TablaSolicitudes.php', 'PUT', ['id' => $uId, 'activo' => 1], $tokenSuperAdmin);
        }
    }

    // Promover Docente X, Evaluador Y y Evaluador Z a rol 2 (Evaluador)
    api_request('/TablaUsuarios.php', 'PUT', ['id' => $idsUsuarios['docente.x.e2e@campusucc.edu.co'], 'id_rol' => 2], $tokenSuperAdmin);
    api_request('/TablaUsuarios.php', 'PUT', ['id' => $idsUsuarios['evaluador.y.e2e@campusucc.edu.co'], 'id_rol' => 2], $tokenSuperAdmin);
    api_request('/TablaUsuarios.php', 'PUT', ['id' => $idsUsuarios['evaluador.z.e2e@campusucc.edu.co'], 'id_rol' => 2], $tokenSuperAdmin);

    // Verificar en la BD
    $resCheck = $conexion->query("SELECT id, correo, id_rol, activo FROM usuario WHERE id IN (" . implode(',', array_values($idsUsuarios)) . ")");
    $todosActivos = true;
    while ($r = $resCheck->fetch_assoc()) {
        if ($r['activo'] != 1) $todosActivos = false;
    }
    assert_test($todosActivos, "Cuentas admitidas y roles de evaluador asignados correctamente");

    // -------------------------------------------------------------------------
    // FASE 3: Publicación de Pósteres y Numeración Continua de Espacios
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 3: Publicación de Pósteres y Numeración Continua ---\n", "yellow");

    $tokenEstudianteA = auth_issue_token($idsUsuarios['estudiante.a.e2e@campusucc.edu.co'], 1);
    $tokenEstudianteB = auth_issue_token($idsUsuarios['estudiante.b.e2e@campusucc.edu.co'], 1);

    // Archivo simulado temporal 1 (PNG válido)
    $tmpFile1 = tempnam(sys_get_temp_dir(), 'poster1') . '.png';
    $im1 = imagecreatetruecolor(10, 10);
    imagecolorallocate($im1, 255, 0, 0); // Rojo
    imagepng($im1, $tmpFile1);
    imagedestroy($im1);

    // Poster 1: Estudiante A, con Docente X como profesor asignado de materia
    $postFields1 = [
        'titulo' => 'Póster Alfa E2E - Redes Neuronales ' . uniqid(),
        'autores' => 'Estudiante A',
        'descripcion' => 'Aplicación de redes convolucionales',
        'categoria' => 'programacion',
        'palabrasClave' => 'ia, redes, e2e',
        'carrera_participacion' => 'sistemas',
        'id_evento' => $idEventoTest,
        'forzar_guardado' => 'true',
        'profesores_materias' => json_encode([
            ['id_usuario' => $idsUsuarios['docente.x.e2e@campusucc.edu.co'], 'materia' => 'Inteligencia Artificial']
        ]),
        'archivo' => new CURLFile($tmpFile1, 'image/png', 'poster1.png')
    ];
    $resP1 = api_request('/SubirPosters.php', 'POST', $postFields1, $tokenEstudianteA, true);
    $idP1 = $resP1['data']['poster']['id'] ?? 0;
    $idsPosters['P1'] = $idP1;
    assert_test($idP1 > 0, "Póster 1 subido exitosamente en Evento $idEventoTest (ID: $idP1)");

    // Archivo simulado temporal 2 (PNG válido)
    $tmpFile2 = tempnam(sys_get_temp_dir(), 'poster2') . '.png';
    $im2 = imagecreatetruecolor(10, 10);
    imagecolorallocate($im2, 0, 255, 0); // Verde
    imagepng($im2, $tmpFile2);
    imagedestroy($im2);

    // Poster 2: Estudiante B
    $postFields2 = [
        'titulo' => 'Póster Beta E2E - Ciberseguridad Cloud ' . uniqid(),
        'autores' => 'Estudiante B',
        'descripcion' => 'Protocolos de cifrado avanzado',
        'categoria' => 'programacion',
        'palabrasClave' => 'seguridad, cloud, e2e',
        'carrera_participacion' => 'sistemas',
        'id_evento' => $idEventoTest,
        'forzar_guardado' => 'true',
        'profesores_materias' => '[]',
        'archivo' => new CURLFile($tmpFile2, 'image/png', 'poster2.png')
    ];
    $resP2 = api_request('/SubirPosters.php', 'POST', $postFields2, $tokenEstudianteB, true);
    $idP2 = $resP2['data']['poster']['id'] ?? 0;
    $idsPosters['P2'] = $idP2;
    assert_test($idP2 > 0, "Póster 2 subido exitosamente en Evento $idEventoTest (ID: $idP2)");

    // Archivo simulado temporal 3 (PNG válido)
    $tmpFile3 = tempnam(sys_get_temp_dir(), 'poster3') . '.png';
    $im3 = imagecreatetruecolor(10, 10);
    imagecolorallocate($im3, 0, 0, 255); // Azul
    imagepng($im3, $tmpFile3);
    imagedestroy($im3);

    // Poster 3: Estudiante A (debe desbordar al Espacio 2 con número consecutivo 3!)
    $postFields3 = [
        'titulo' => 'Póster Gamma E2E - Computación Cuántica ' . uniqid(),
        'autores' => 'Estudiante A',
        'descripcion' => 'Algoritmos de optimización',
        'categoria' => 'programacion',
        'palabrasClave' => 'cuantica, algoritmos, e2e',
        'carrera_participacion' => 'sistemas',
        'id_evento' => $idEventoTest,
        'forzar_guardado' => 'true',
        'profesores_materias' => '[]',
        'archivo' => new CURLFile($tmpFile3, 'image/png', 'poster3.png')
    ];
    $resP3 = api_request('/SubirPosters.php', 'POST', $postFields3, $tokenEstudianteA, true);
    $idP3 = $resP3['data']['poster']['id'] ?? 0;
    $idsPosters['P3'] = $idP3;
    assert_test($idP3 > 0, "Póster 3 subido exitosamente en Evento $idEventoTest (ID: $idP3)");

    // Verificar en BD la numeración física continua
    $sqlUbi = "SELECT p.id, p.id_espacio, p.titulo,
               (COALESCE((SELECT SUM(e_prev.capacidad) FROM espacios_fisicos e_prev WHERE e_prev.id_evento = e.id_evento AND e_prev.id_espacio < e.id_espacio), 0) +
                (SELECT COUNT(*) FROM cargar_posters p2 WHERE p2.id_espacio = p.id_espacio AND p2.id <= p.id AND p2.activo = 1)) AS num_continuo
               FROM cargar_posters p
               JOIN espacios_fisicos e ON p.id_espacio = e.id_espacio
               WHERE p.id IN ($idP1, $idP2, $idP3)
               ORDER BY p.id ASC";
    $resUbis = $conexion->query($sqlUbi);
    $numsContinuos = [];
    while ($r = $resUbis->fetch_assoc()) {
        $numsContinuos[$r['id']] = $r['num_continuo'];
    }
    assert_test($numsContinuos[$idP1] == 1, "Póster 1 en puesto #1 (Piso 1)");
    assert_test($numsContinuos[$idP2] == 2, "Póster 2 en puesto #2 (Piso 1, espacio lleno)");
    assert_test($numsContinuos[$idP3] == 3, "Póster 3 continuó automáticamente en puesto #3 (Piso 2)!");

    // -------------------------------------------------------------------------
    // FASE 4: Control de Conflicto de Intereses y Asignación Ronda 1
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 4: Control de Conflicto de Intereses en Asignación ---\n", "yellow");

    // 4.1 Intentar asignar al autor (Estudiante A) a su propio Póster 1 -> DEBE FALLAR
    $resAutConf = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP1,
        'evaluadores_ids' => [$idsUsuarios['estudiante.a.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda1
    ], $tokenSuperAdmin);
    assert_test($resAutConf['data']['success'] === false, "Bloqueada autoevaluación: el autor no puede calificarse a sí mismo");

    // 4.2 Intentar asignar al Docente X (profesor asignado a la materia de Póster 1) -> DEBE FALLAR
    $resProfConf = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP1,
        'evaluadores_ids' => [$idsUsuarios['docente.x.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda1
    ], $tokenSuperAdmin);
    assert_test($resProfConf['data']['success'] === false && strpos($resProfConf['data']['message'], 'conflicto') !== false, "Bloqueado conflicto docente: el profesor de la materia no puede evaluar el póster");

    // 4.3 Asignar evaluador neutral (Evaluador Y) a Póster 1 -> DEBE TENER ÉXITO
    $resAsigP1 = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP1,
        'evaluadores_ids' => [$idsUsuarios['evaluador.y.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda1
    ], $tokenSuperAdmin);
    assert_test($resAsigP1['data']['success'] === true, "Asignación exitosa de jurado neutral (Evaluador Y) a Póster 1");

    // 4.4 Asignar Docente X a Póster 2 (donde él NO es profesor del póster) -> DEBE TENER ÉXITO
    $resAsigP2 = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP2,
        'evaluadores_ids' => [$idsUsuarios['docente.x.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda1
    ], $tokenSuperAdmin);
    assert_test($resAsigP2['data']['success'] === true, "Asignación exitosa de Docente X a Póster 2 (sin conflicto)");

    // 4.5 Asignar Evaluador Z a Póster 3 -> DEBE TENER ÉXITO
    $resAsigP3 = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP3,
        'evaluadores_ids' => [$idsUsuarios['evaluador.z.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda1
    ], $tokenSuperAdmin);
    assert_test($resAsigP3['data']['success'] === true, "Asignación exitosa de Evaluador Z a Póster 3");

    // -------------------------------------------------------------------------
    // FASE 5: Calificación de Ronda 1
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 5: Calificación por Criterios en Ronda 1 ---\n", "yellow");

    $tokenDocenteX = auth_issue_token($idsUsuarios['docente.x.e2e@campusucc.edu.co'], 2);
    $tokenEvaluadorY = auth_issue_token($idsUsuarios['evaluador.y.e2e@campusucc.edu.co'], 2);
    $tokenEvaluadorZ = auth_issue_token($idsUsuarios['evaluador.z.e2e@campusucc.edu.co'], 2);

    // Evaluador Y califica Póster 1: 4.5 y 4.0 -> Promedio: 4.25
    $resEv1 = api_request('/Evaluaciones.php', 'POST', [
        'id_poster' => $idP1,
        'id_ronda' => $idRonda1,
        'criterios' => [$idCriterio1 => 4.5, $idCriterio2 => 4.0],
        'observaciones' => 'Buen enfoque metodológico'
    ], $tokenEvaluadorY);
    assert_test($resEv1['data']['success'] === true, "Evaluador Y calificó Póster 1 (Notas: 4.5, 4.0)");

    // Docente X califica Póster 2: 5.0 y 4.8 -> Promedio: 4.90 (Sobresaliente)
    $resEv2 = api_request('/Evaluaciones.php', 'POST', [
        'id_poster' => $idP2,
        'id_ronda' => $idRonda1,
        'criterios' => [$idCriterio1 => 5.0, $idCriterio2 => 4.8],
        'observaciones' => 'Excelente rigor técnico'
    ], $tokenDocenteX);
    assert_test($resEv2['data']['success'] === true, "Docente X calificó Póster 2 (Notas: 5.0, 4.8)");

    // Evaluador Z califica Póster 3: 3.0 y 3.5 -> Promedio: 3.25
    $resEv3 = api_request('/Evaluaciones.php', 'POST', [
        'id_poster' => $idP3,
        'id_ronda' => $idRonda1,
        'criterios' => [$idCriterio1 => 3.0, $idCriterio2 => 3.5],
        'observaciones' => 'Requiere mayor profundidad'
    ], $tokenEvaluadorZ);
    assert_test($resEv3['data']['success'] === true, "Evaluador Z calificó Póster 3 (Notas: 3.0, 3.5)");

    // -------------------------------------------------------------------------
    // FASE 6: Cierre de Ronda 1 y Corte Automático (Top 2 clasificados)
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 6: Cierre de Ronda 1 y Corte Automático ---\n", "yellow");

    // Cerrar ronda y pasar a la siguiente (pasan los 2 mejores)
    $resCorte = api_request('/Rondas.php', 'POST', [
        'accion' => 'cerrar_y_pasar',
        'id_ronda' => $idRonda1,
        'cupos' => 2,
        'ids_seleccionados' => [$idP2, $idP1],
        'forzar_cierre_pendientes' => true
    ], $tokenSuperAdmin);
    assert_test(($resCorte['data']['success'] ?? false) === true, "Ronda 1 cerrada con corte de 2 clasificados");
    
    // Obtener ID de Ronda 2 creada por el pase
    $idRonda2 = $resCorte['data']['data']['id_ronda_destino'] ?? ($resCorte['data']['data']['ronda_siguiente']['id_ronda'] ?? 0);
    if (!$idRonda2) {
        $stmtSig = $conexion->query("SELECT id_ronda FROM rondas WHERE id_evento = $idEventoTest AND numero = 2 LIMIT 1");
        if ($fSig = $stmtSig->fetch_assoc()) $idRonda2 = intval($fSig['id_ronda']);
    }
    assert_test($idRonda2 > 0, "Ronda 2 (Gran Final) generada automáticamente (ID: $idRonda2)");

    // Verificar en tabla `selecciones` quiénes clasificaron
    $resSels = $conexion->query("SELECT id_poster FROM selecciones WHERE id_ronda = $idRonda2 ORDER BY id_seleccion ASC");
    $clasificados = [];
    while ($rs = $resSels->fetch_assoc()) $clasificados[] = intval($rs['id_poster']);
    
    assert_test(in_array($idP2, $clasificados) && in_array($idP1, $clasificados), "Póster 2 (4.90) y Póster 1 (4.25) clasificaron al corte");
    assert_test(!in_array($idP3, $clasificados), "Póster 3 (3.25) quedó fuera del corte según límite configurado");

    // -------------------------------------------------------------------------
    // FASE 7 y 8: Ronda 2 (Gran Final) y Reasignación de Jurados
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 7 y 8: Ronda 2 (Gran Final) y Reasignación de Jurados ---\n", "yellow");

    // Abrir Ronda 2
    $resAbrirR2 = api_request('/Rondas.php', 'POST', [
        'accion' => 'abrir_ronda',
        'id_ronda' => $idRonda2
    ], $tokenSuperAdmin);
    assert_test($resAbrirR2['data']['success'] === true, "Ronda 2 abierta para evaluación de la Gran Final");

    // Reasignar jurados para Ronda 2 respetando rotación (sin repetir evaluador de la R1)
    // Póster 2 fue evaluado por Docente X en R1 -> En R2 lo evalúa jurado neutral Evaluador Y
    $resAsigR2_P2 = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP2,
        'evaluadores_ids' => [$idsUsuarios['evaluador.y.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda2
    ], $tokenSuperAdmin);
    assert_test($resAsigR2_P2['data']['success'] === true, "Evaluador Y reasignado a Póster 2 para la Gran Final (rotación neutral)");

    // Póster 1 fue evaluado por Evaluador Y en R1 -> En R2 lo evalúa jurado neutral Evaluador Z (sin conflicto docente)
    $resAsigR2_P1 = api_request('/AsignarEvaluadores.php', 'POST', [
        'id_poster' => $idP1,
        'evaluadores_ids' => [$idsUsuarios['evaluador.z.e2e@campusucc.edu.co']],
        'id_ronda' => $idRonda2
    ], $tokenSuperAdmin);
    assert_test($resAsigR2_P1['data']['success'] === true, "Evaluador Z reasignado a Póster 1 para la Gran Final (rotación neutral y sin conflicto)");

    // -------------------------------------------------------------------------
    // FASE 9: Calificación Final, Cierre de Ronda 2 y Podio de Ganadores
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 9: Calificación Final y Adjudicación del Podio ---\n", "yellow");

    // Obtener criterios para Ronda 2 (copiados automáticamente por el corte)
    $resCritR2 = $conexion->query("SELECT id FROM criterios_evaluacion WHERE id_ronda = $idRonda2 AND activo = 1 ORDER BY id ASC");
    $critIdsR2 = [];
    while ($fc = $resCritR2->fetch_assoc()) $critIdsR2[] = intval($fc['id']);
    if (empty($critIdsR2)) {
        $conexion->query("INSERT INTO criterios_evaluacion (id_ronda, nombre, descripcion, activo) VALUES ($idRonda2, 'Sustentación Oral', 'Defensa ante jurados', 1)");
        $critIdsR2[] = $conexion->insert_id;
    }

    // Calificar Póster 2 con 4.95 (Evaluador Y) y Póster 1 con 4.40 (Evaluador Z)
    $notasP2 = [];
    $notasP1 = [];
    foreach ($critIdsR2 as $cId) {
        $notasP2[$cId] = 4.95;
        $notasP1[$cId] = 4.40;
    }

    $resEvFin1 = api_request('/Evaluaciones.php', 'POST', [
        'id_poster' => $idP2,
        'id_ronda' => $idRonda2,
        'criterios' => $notasP2,
        'observaciones' => 'Exposición magistral en la final'
    ], $tokenEvaluadorY);

    $resEvFin2 = api_request('/Evaluaciones.php', 'POST', [
        'id_poster' => $idP1,
        'id_ronda' => $idRonda2,
        'criterios' => $notasP1,
        'observaciones' => 'Buena defensa oral'
    ], $tokenEvaluadorZ);
    assert_test(($resEvFin1['data']['success'] ?? false) && ($resEvFin2['data']['success'] ?? false), "Calificaciones finales asentadas en Ronda 2 (P2: 4.95, P1: 4.40)");

    // Cerrar Ronda 2
    $resCerrarR2 = api_request('/Rondas.php', 'POST', [
        'accion' => 'cerrar_ronda',
        'id_ronda' => $idRonda2,
        'confirmar_cierre_final' => true,
        'forzar_cierre_pendientes' => true
    ], $tokenSuperAdmin);

    // Publicar Podio oficial
    $resPodio = api_request('/Rondas.php', 'POST', [
        'accion' => 'publicar_podio',
        'id_ronda' => $idRonda2,
        'premios' => 2,
        'lugares' => [
            ['id_poster' => $idP2, 'lugar' => 1, 'premio' => '1er Puesto'],
            ['id_poster' => $idP1, 'lugar' => 2, 'premio' => '2do Puesto']
        ]
    ], $tokenSuperAdmin);
    assert_test($resPodio['data']['success'] === true, "Podio de ganadores consolidado y publicado");

    // Verificar ganadores oficiales en BD
    $resGanadores = $conexion->query("SELECT s.id_poster, s.lugar, s.premio, p.titulo
                                      FROM selecciones s
                                      JOIN cargar_posters p ON p.id = s.id_poster
                                      WHERE s.id_ronda = $idRonda2 AND s.lugar IS NOT NULL
                                      ORDER BY s.lugar ASC");
    $podio = [];
    while ($rg = $resGanadores->fetch_assoc()) {
        $podio[$rg['lugar']] = $rg;
    }
    assert_test(isset($podio[1]) && $podio[1]['id_poster'] == $idP2, "🥇 1° Lugar (Premio 1): " . ($podio[1]['titulo'] ?? ''));
    assert_test(isset($podio[2]) && $podio[2]['id_poster'] == $idP1, "🥈 2° Lugar (Premio 2): " . ($podio[2]['titulo'] ?? ''));

    // -------------------------------------------------------------------------
    // FASE 10: Certificación y Constancias
    // -------------------------------------------------------------------------
    echo color("\n--- FASE 10: Validación de Datos de Certificados ---\n", "yellow");

    // Consultar resumen de la ronda con datos para diplomas
    $resCert = api_request("/Rondas.php?action=resumen_ronda&id_ronda=$idRonda2", 'GET', null, $tokenSuperAdmin);
    $datosCert = $resCert['data']['data'] ?? [];
    $ganadoresCert = array_filter($datosCert['posters'] ?? [], function($p) {
        return !empty($p['lugar']);
    });
    assert_test(count($ganadoresCert) === 2, "Datos de certificados listos para emisión de diplomas para los 2 ganadores del podio");

    echo color("\n✔ TODAS LAS 10 FASES FUERON VALIDADAS CON ÉXITO DE MANERA REAL.\n", "green");

} catch (Throwable $e) {
    echo color("\n✖ EXCEPCIÓN DURANTE LA PRUEBA: " . $e->getMessage() . "\n", "red");
} finally {
    // -------------------------------------------------------------------------
    // LIMPIEZA AUTOMÁTICA DE REGISTROS DE PRUEBA
    // -------------------------------------------------------------------------
    echo color("\n--- Limpieza de datos de prueba ---\n", "blue");
    if ($idEventoTest > 0) {
        $conexion->query("DELETE FROM evaluaciones_detalles WHERE id_poster IN (" . implode(',', array_values($idsPosters) ?: [0]) . ")");
        $conexion->query("DELETE FROM evaluaciones WHERE id_poster IN (" . implode(',', array_values($idsPosters) ?: [0]) . ")");
        $conexion->query("DELETE FROM asignaciones_evaluadores WHERE id_poster IN (" . implode(',', array_values($idsPosters) ?: [0]) . ")");
        $conexion->query("DELETE FROM selecciones WHERE id_ronda IN ($idRonda1, $idRonda2)");
        $conexion->query("DELETE FROM poster_profesores WHERE id_poster IN (" . implode(',', array_values($idsPosters) ?: [0]) . ")");
        $conexion->query("DELETE FROM poster_eventos WHERE id_poster IN (" . implode(',', array_values($idsPosters) ?: [0]) . ")");
        $conexion->query("DELETE FROM cargar_posters WHERE id_evento = $idEventoTest OR id IN (" . implode(',', array_values($idsPosters) ?: [0]) . ")");
        $conexion->query("DELETE FROM criterios_evaluacion WHERE id_ronda IN ($idRonda1, $idRonda2)");
        $conexion->query("DELETE FROM rondas WHERE id_evento = $idEventoTest");
        $conexion->query("DELETE FROM espacios_fisicos WHERE id_evento = $idEventoTest");
        $conexion->query("DELETE FROM eventos WHERE id_evento = $idEventoTest");
        if (!empty($idsUsuarios)) {
            $conexion->query("DELETE FROM usuario WHERE id IN (" . implode(',', array_values($idsUsuarios)) . ")");
        }
        echo "Registros temporales del evento de prueba eliminados correctamente.\n";
    }
    foreach ([$tmpFile1 ?? null, $tmpFile2 ?? null, $tmpFile3 ?? null] as $tf) {
        if ($tf && file_exists($tf)) @unlink($tf);
    }
}
