<?php
/**
 * scripts/escenario_capturas.php
 * Prepara datos de demostración realistas por etapas para tomar capturas de pantalla
 * de las 10 fases del sistema y restaura el estado original al terminar.
 */

require_once __DIR__ . '/../backend/Conexion.php';
require_once __DIR__ . '/../backend/api/includes/Auth.php';

$accion = $argv[1] ?? 'init';

if ($accion === 'init') {
    // 1. Limpiar posibles restos previos
    $conexion->query("DELETE FROM usuario WHERE correo IN ('daniela.ospina.demo@campusucc.edu.co', 'alejandro.vega.demo@campusucc.edu.co')");
    $conexion->query("DELETE FROM evaluaciones_detalles WHERE id_poster IN (31, 32, 35)");
    $conexion->query("DELETE FROM evaluaciones WHERE id_poster IN (31, 32, 35)");
    $conexion->query("DELETE FROM selecciones WHERE id_ronda IN (1, 3)");
    $conexion->query("DELETE FROM asignaciones_evaluadores WHERE id_poster IN (31, 32)");

    // 2. Crear 2 solicitudes pendientes de registro para que la tabla Solicitudes luzca completa
    $hash = password_hash('Demo1234!', PASSWORD_BCRYPT);
    $stmtS1 = $conexion->prepare("INSERT INTO usuario (nombres, apellidos, correo, `contraseña`, id_rol, carrera, activo, desactivado) VALUES (?, ?, ?, ?, 1, ?, 0, 0)");
    $n1 = 'Daniela Fernanda'; $a1 = 'Ospina Ríos'; $c1 = 'daniela.ospina.demo@campusucc.edu.co'; $car1 = 'Ingeniería de Sistemas';
    $stmtS1->bind_param("sssss", $n1, $a1, $c1, $hash, $car1);
    $stmtS1->execute();
    $n2 = 'Alejandro José'; $a2 = 'Vega Quintero'; $c2 = 'alejandro.vega.demo@campusucc.edu.co'; $car2 = 'Ingeniería Civil';
    $stmtS1->bind_param("sssss", $n2, $a2, $c2, $hash, $car2);
    $stmtS1->execute();
    $stmtS1->close();

    // 3. Embellecer temporalmente el póster 35 para que todos los pósteres en pantalla tengan títulos académicos reales
    $conexion->query("UPDATE cargar_posters SET 
        titulo = 'Optimización de Rutas Logísticas con Algoritmos Genéticos',
        autores = 'Juan Camilo Murillo, Sofía Herrera',
        descripcion = 'Modelo bioinspirado para reducir tiempos de distribución urbana en ciudades intermedias.',
        palabrasClave = 'algoritmos geneticos, optimizacion, logistica',
        id_espacio = 1
        WHERE id = 35");

    // Asegurar profesores asociados a los pósteres 31 y 32
    $conexion->query("DELETE FROM poster_profesores WHERE id_poster IN (31, 32, 35)");
    $conexion->query("INSERT INTO poster_profesores (id_poster, id_usuario, materia) VALUES
        (31, 54, 'Seguridad Informática'),
        (32, 55, 'Ingeniería de Software II'),
        (35, 58, 'Inteligencia Artificial')");

    // 4. Configurar Ronda 1 abierta con cupo 2 y premios 2
    $conexion->query("UPDATE rondas SET estado = 'abierta', corte_confirmado = 0, cupos_seleccion = 2, premios = 2 WHERE id_ronda = 1");
    $conexion->query("UPDATE rondas SET estado = 'cerrada', corte_confirmado = 0, cupos_seleccion = NULL, premios = 2 WHERE id_ronda = 3");

    // 5. Asignar evaluadores en Ronda 1:
    // Poster 31 -> Laura Gómez (46) - Ya evaluado (promedio 4.83)
    // Poster 32 -> Andrés Pinedo (51) - Ya evaluado (promedio 4.50)
    // Poster 35 -> Laura Gómez (46) - Pendiente de evaluar (para mostrar el botón Calificar en el panel de Laura)
    $conexion->query("INSERT IGNORE INTO asignaciones_evaluadores (id_poster, id_evaluador, id_ronda) VALUES
        (31, 46, 1),
        (32, 51, 1),
        (35, 46, 1)");

    // Insertar evaluaciones de Ronda 1 para Póster 31 y Póster 32
    $conexion->query("INSERT INTO evaluaciones (id_poster, id_ronda, id_evaluador, calificacion_contenido, calificacion_diseño, calificacion_exposicion, promedio_total, observaciones) VALUES
        (31, 1, 46, 4.90, 4.80, 4.80, 4.83, 'Excelente fundamentación técnica y pruebas en entorno real.'),
        (32, 1, 51, 4.50, 4.60, 4.40, 4.50, 'Muy buena interfaz y utilidad práctica para la comunidad estudiantil.')");

    $conexion->query("INSERT INTO evaluaciones_detalles (id_poster, id_ronda, id_evaluador, id_criterio, calificacion, observaciones) VALUES
        (31, 1, 46, 1, 4.90, 'Excelente fundamentación técnica y pruebas en entorno real.'),
        (31, 1, 46, 2, 4.80, 'Excelente fundamentación técnica y pruebas en entorno real.'),
        (31, 1, 46, 3, 4.80, 'Excelente fundamentación técnica y pruebas en entorno real.'),
        (32, 1, 51, 1, 4.50, 'Muy buena interfaz y utilidad práctica para la comunidad estudiantil.'),
        (32, 1, 51, 2, 4.60, 'Muy buena interfaz y utilidad práctica para la comunidad estudiantil.'),
        (32, 1, 51, 3, 4.40, 'Muy buena interfaz y utilidad práctica para la comunidad estudiantil.')");

    echo json_encode([
        'ok' => true,
        'tokenSuperAdmin' => auth_issue_token(1, 4),
        'tokenEvaluador' => auth_issue_token(46, 2),
        'tokenUsuario' => auth_issue_token(10, 1)
    ]);
    exit;
}

if ($accion === 'completar_ronda1') {
    // Evaluar también el póster 35 con 3.80 para que los 3 pósteres estén calificados antes del corte
    $conexion->query("INSERT INTO evaluaciones (id_poster, id_ronda, id_evaluador, calificacion_contenido, calificacion_diseño, calificacion_exposicion, promedio_total, observaciones) VALUES
        (35, 1, 46, 3.80, 3.90, 3.70, 3.80, 'Buen planteamiento matemático, falta ampliar validación experimental.')");
    $conexion->query("INSERT INTO evaluaciones_detalles (id_poster, id_ronda, id_evaluador, id_criterio, calificacion, observaciones) VALUES
        (35, 1, 46, 1, 3.80, 'Buen planteamiento matemático, falta ampliar validación experimental.'),
        (35, 1, 46, 2, 3.90, 'Buen planteamiento matemático, falta ampliar validación experimental.'),
        (35, 1, 46, 3, 3.70, 'Buen planteamiento matemático, falta ampliar validación experimental.')");
    echo json_encode(['ok' => true]);
    exit;
}

if ($accion === 'fase_ronda2') {
    // Cerrar Ronda 1 con corte confirmado y abrir Ronda 2 (id_ronda = 3) con los 2 clasificados (31 y 32)
    $conexion->query("UPDATE rondas SET estado = 'cerrada', corte_confirmado = 1, fecha_cierre = NOW(), cupos_seleccion = 2 WHERE id_ronda = 1");
    $conexion->query("UPDATE rondas SET estado = 'abierta', corte_confirmado = 0, fecha_cierre = NULL, premios = 2 WHERE id_ronda = 3");

    $conexion->query("DELETE FROM selecciones WHERE id_ronda = 3");
    $conexion->query("INSERT INTO selecciones (id_ronda, id_poster, seleccion_manual, notificado) VALUES
        (3, 31, 0, 1),
        (3, 32, 0, 1)");

    // Rotar evaluadores en Ronda 2: Poster 31 -> Andrés Pinedo (51), Poster 32 -> Laura Gómez (46)
    $conexion->query("DELETE FROM asignaciones_evaluadores WHERE id_ronda = 3");
    $conexion->query("INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador, id_ronda) VALUES
        (31, 51, 3),
        (32, 46, 3)");

    // Insertar evaluaciones finales en Ronda 2 (id_ronda = 3, criterios 7, 8, 9)
    $conexion->query("INSERT INTO evaluaciones (id_poster, id_ronda, id_evaluador, calificacion_contenido, calificacion_diseño, calificacion_exposicion, promedio_total, observaciones) VALUES
        (31, 3, 51, 4.95, 4.90, 5.00, 4.95, 'Defensa magistral ante el jurado en el auditorio.'),
        (32, 3, 46, 4.70, 4.60, 4.65, 4.65, 'Gran dominio del tema y demostración funcional en vivo.')");

    $conexion->query("INSERT INTO evaluaciones_detalles (id_poster, id_ronda, id_evaluador, id_criterio, calificacion, observaciones) VALUES
        (31, 3, 51, 7, 4.95, 'Defensa magistral ante el jurado en el auditorio.'),
        (31, 3, 51, 8, 4.90, 'Defensa magistral ante el jurado en el auditorio.'),
        (31, 3, 51, 9, 5.00, 'Defensa magistral ante el jurado en el auditorio.'),
        (32, 3, 46, 7, 4.70, 'Gran dominio del tema y demostración funcional en vivo.'),
        (32, 3, 46, 8, 4.60, 'Gran dominio del tema y demostración funcional en vivo.'),
        (32, 3, 46, 9, 4.65, 'Gran dominio del tema y demostración funcional en vivo.')");

    echo json_encode(['ok' => true]);
    exit;
}

if ($accion === 'fase_podio') {
    // Cerrar Ronda 2 y publicar ganadores oficiales en el podio
    $conexion->query("UPDATE rondas SET estado = 'cerrada', fecha_cierre = NOW(), premios = 2 WHERE id_ronda = 3");
    $conexion->query("UPDATE selecciones SET lugar = 1, premio = '1º lugar' WHERE id_ronda = 3 AND id_poster = 31");
    $conexion->query("UPDATE selecciones SET lugar = 2, premio = '2º lugar' WHERE id_ronda = 3 AND id_poster = 32");
    echo json_encode(['ok' => true]);
    exit;
}

if ($accion === 'cleanup') {
    $conexion->query("DELETE FROM usuario WHERE correo IN ('daniela.ospina.demo@campusucc.edu.co', 'alejandro.vega.demo@campusucc.edu.co')");
    $conexion->query("DELETE FROM evaluaciones_detalles WHERE id_poster IN (31, 32, 35)");
    $conexion->query("DELETE FROM evaluaciones WHERE id_poster IN (31, 32, 35)");
    $conexion->query("DELETE FROM selecciones WHERE id_ronda IN (1, 3)");
    $conexion->query("DELETE FROM asignaciones_evaluadores WHERE id_poster IN (31, 32) OR (id_poster = 35 AND id_ronda = 3)");
    $conexion->query("DELETE FROM poster_profesores WHERE id_poster IN (31, 32, 35)");
    $conexion->query("UPDATE cargar_posters SET titulo = 'dfg', autores = 'dfg', descripcion = 'dfg', palabrasClave = 'dfh' WHERE id = 35");
    $conexion->query("UPDATE rondas SET estado = 'abierta', corte_confirmado = 0, fecha_cierre = NULL, cupos_seleccion = 10, premios = 3 WHERE id_ronda = 1");
    $conexion->query("UPDATE rondas SET estado = 'cerrada', corte_confirmado = 0, fecha_cierre = '2026-10-19 08:01:02', cupos_seleccion = NULL, premios = 3 WHERE id_ronda = 3");
    echo json_encode(['ok' => true]);
    exit;
}
