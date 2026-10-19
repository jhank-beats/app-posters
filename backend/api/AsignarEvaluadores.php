<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, OPTIONS");

include '../Conexion.php';
include_once __DIR__ . '/includes/Correos.php';
include_once __DIR__ . '/includes/RondasHelper.php';

if (!isset($conexion) || $conexion->connect_error) {
    echo json_encode([
        'success' => false,
        'message' => 'Error de conexión a la base de datos'
    ]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // La lista trae correos y nombres de los evaluadores: solo admin/super admin.
        require_role([3, 4]);
        obtenerEvaluadoresYAsignaciones($conexion);
        break;
    case 'POST':
        // Reasignar evaluadores es una operación de administración.
        require_role([3, 4]);
        guardarAsignacion($conexion);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Método no permitido']);
        break;
}

// Regla de la Fase 1 (mejora 2026-10): en la Ronda 1 cada póster tiene UN SOLO
// evaluador; desde la Ronda 2 en adelante puede tener varios (la nota que ve el
// autor es el promedio entre todos).
function limiteEvaluadores($numeroRonda)
{
    return intval($numeroRonda) <= 1 ? 1 : 5;
}

// Ronda de trabajo de un póster: la indicada por el cliente (si es válida y
// pertenece al evento) o, por defecto, la ronda 1 de ese evento.
// Devuelve ['id_ronda' => int, 'numero' => int, 'limite' => int].
function rondaDeAsignacion($conexion, $id_poster, $id_ronda_solicitada)
{
    $id_ronda_solicitada = intval($id_ronda_solicitada);
    if ($id_ronda_solicitada > 0) {
        $sql = "SELECT r.id_ronda, r.numero FROM rondas r
                JOIN cargar_posters p ON (p.id_evento = r.id_evento OR EXISTS (SELECT 1 FROM poster_eventos pe WHERE pe.id_poster = p.id AND pe.id_evento = r.id_evento))
                WHERE p.id = ? AND r.id_ronda = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("ii", $id_poster, $id_ronda_solicitada);
        $stmt->execute();
        $fila = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($fila) {
            $numero = intval($fila['numero']);
            return ['id_ronda' => intval($fila['id_ronda']), 'numero' => $numero, 'limite' => limiteEvaluadores($numero)];
        }
    }
    $sql = "SELECT r.id_ronda, r.numero FROM cargar_posters p
            JOIN rondas r ON r.id_evento = p.id_evento AND r.numero = 1
            WHERE p.id = ?";
    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("i", $id_poster);
    $stmt->execute();
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($fila) {
        $numero = intval($fila['numero']);
        return ['id_ronda' => intval($fila['id_ronda']), 'numero' => $numero, 'limite' => limiteEvaluadores($numero)];
    }
    return ['id_ronda' => 0, 'numero' => 0, 'limite' => 1];
}

function obtenerEvaluadoresYAsignaciones($conexion)
{
    try {
        $id_poster = isset($_GET['id_poster']) ? intval($_GET['id_poster']) : 0;
        $carrera = isset($_GET['carrera']) ? trim($_GET['carrera']) : '';

        // Ronda de la consulta: marca "asignado" solo en ESA ronda (por defecto
        // la ronda 1 del evento), sin mirar el histórico de las demás.
        $id_ronda = isset($_GET['id_ronda']) ? intval($_GET['id_ronda']) : 0;
        $rondaCtx = ['id_ronda' => 0, 'numero' => 0, 'limite' => 1];
        $id_autor = 0;
        if ($id_poster > 0) {
            $rondaCtx = rondaDeAsignacion($conexion, $id_poster, $id_ronda);
            $id_ronda = $rondaCtx['id_ronda'];

            $stmtAutor = $conexion->prepare("SELECT id_usuario FROM cargar_posters WHERE id = ? LIMIT 1");
            if ($stmtAutor) {
                $stmtAutor->bind_param("i", $id_poster);
                $stmtAutor->execute();
                if ($filaAutor = $stmtAutor->get_result()->fetch_assoc()) {
                    $id_autor = intval($filaAutor['id_usuario'] ?? 0);
                }
                $stmtAutor->close();
            }
        }

        // Fase 3: excluir al autor del póster de la lista de evaluadores disponibles
        // para impedir la autoevaluación desde la asignación.
        $sql = "SELECT 
                    u.id, 
                    CONCAT(u.nombres, ' ', u.apellidos) AS nombre_completo,
                    u.correo,
                    u.carrera,
                    IF(ae.id_asignacion IS NOT NULL, 1, 0) AS asignado
                FROM usuario u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                LEFT JOIN asignaciones_evaluadores ae 
                    ON u.id = ae.id_evaluador AND ae.id_poster = ? AND ae.id_ronda = ?
                WHERE r.nombre_rol = 'Evaluador'
                  AND u.id <> COALESCE((SELECT id_usuario FROM cargar_posters WHERE id = ?), 0)";

        if (!empty($carrera)) {
            $sql .= " AND u.carrera LIKE ?";
        }

        $sql .= " ORDER BY u.nombres ASC";

        $stmt = $conexion->prepare($sql);

        if (!empty($carrera)) {
            $term = "%" . $carrera . "%";
            $stmt->bind_param("iiis", $id_poster, $id_ronda, $id_poster, $term);
        } else {
            $stmt->bind_param("iii", $id_poster, $id_ronda, $id_poster);
        }

        $stmt->execute();
        $resultado = $stmt->get_result();

        $evaluadores = [];
        while ($row = $resultado->fetch_assoc()) {
            $row['id'] = intval($row['id']);
            $row['asignado'] = (bool) $row['asignado'];
            $evaluadores[] = $row;
        }

        echo json_encode([
            'success' => true,
            // `ronda` y `limite`: en la Ronda 1 solo cabe 1 evaluador (la
            // interfaz debe mostrar selección única); desde la Ronda 2, varios.
            'ronda' => $rondaCtx,
            'limite' => $rondaCtx['limite'],
            'id_autor' => $id_autor,
            'data' => $evaluadores
        ]);

    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error al obtener evaluadores: ' . $e->getMessage()
        ]);
    }
}

function guardarAsignacion($conexion)
{
    try {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['id_poster']) || !isset($data['evaluadores_ids'])) {
            echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
            return;
        }

        $id_poster = intval($data['id_poster']);
        // ids únicos y enteros (una misma lista repetida no debe pasar el límite).
        $evaluadores_ids = array_values(array_unique(array_map('intval', (array)$data['evaluadores_ids'])));

        // Verificar existencia del póster y obtener su autor y título.
        $sqlPoster = "SELECT id_usuario, titulo FROM cargar_posters WHERE id = ? LIMIT 1";
        $stmtP = $conexion->prepare($sqlPoster);
        $stmtP->bind_param("i", $id_poster);
        $stmtP->execute();
        $rowP = $stmtP->get_result()->fetch_assoc();
        $stmtP->close();

        if (!$rowP) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'El póster indicado no existe']);
            return;
        }

        $id_autor_poster = intval($rowP['id_usuario'] ?? 0);
        $tituloPoster = !empty($rowP['titulo']) ? $rowP['titulo'] : "Póster";

        // Fase 3: bloquear en servidor que el autor del póster sea asignado como su propio evaluador.
        if ($id_autor_poster > 0 && in_array($id_autor_poster, $evaluadores_ids, true)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'codigo' => 'conflicto_interes_autor',
                'message' => 'No se puede asignar al autor del póster como evaluador de su propio póster (no autoevaluación).'
            ]);
            return;
        }

        // Ronda a la que aplican las asignaciones (por defecto la ronda 1 del
        // evento). SIN este filtro se borraba el histórico de TODAS las rondas
        // y se destruía la reasignación aleatoria de la ronda 2 (bug Fase 1).
        $rondaCtx = rondaDeAsignacion($conexion, $id_poster, $data['id_ronda'] ?? 0);
        $id_ronda_asig = $rondaCtx['id_ronda'];
        if ($id_ronda_asig <= 0) {
            echo json_encode(['success' => false, 'message' => 'El póster no tiene una ronda de evaluación válida']);
            return;
        }

        // REGLA (Fase 1 / mejora 2026-10): la Ronda 1 tiene UN SOLO evaluador
        // por póster. Desde la Ronda 2 pueden ser varios.
        $limite = $rondaCtx['limite'];
        if (count($evaluadores_ids) > $limite) {
            echo json_encode([
                'success' => false,
                'message' => $limite === 1
                    ? 'En la Ronda 1 solo puede haber UN evaluador por póster. Selecciona uno solo.'
                    : "En esta ronda puede haber como máximo {$limite} evaluadores por póster.",
                'limite' => $limite
            ]);
            return;
        }

        $conexion->begin_transaction();

        // 0. Evaluadores ya asignados en ESTA ronda para calcular el diff (altas y bajas)
        $evaluadoresPrevios = [];
        $stmtPrev = $conexion->prepare("SELECT id_evaluador FROM asignaciones_evaluadores WHERE id_poster = ? AND id_ronda = ?");
        $stmtPrev->bind_param("ii", $id_poster, $id_ronda_asig);
        $stmtPrev->execute();
        $resPrev = $stmtPrev->get_result();
        while ($filaPrev = $resPrev->fetch_assoc()) {
            $evaluadoresPrevios[intval($filaPrev['id_evaluador'])] = true;
        }
        $stmtPrev->close();

        $idsPrevios = array_keys($evaluadoresPrevios);
        $bajasIds = array_values(array_diff($idsPrevios, $evaluadores_ids));
        $altasIds = array_values(array_diff($evaluadores_ids, $idsPrevios));

        // 1. Eliminar únicamente las asignaciones que salieron en el diff (bajas)
        if (!empty($bajasIds)) {
            $stmtDelete = $conexion->prepare("DELETE FROM asignaciones_evaluadores WHERE id_poster = ? AND id_ronda = ? AND id_evaluador = ?");
            if (!$stmtDelete) {
                throw new Exception('No se pudo preparar la eliminación de asignaciones previas');
            }
            foreach ($bajasIds as $id_baja) {
                $idBajaInt = intval($id_baja);
                $stmtDelete->bind_param("iii", $id_poster, $id_ronda_asig, $idBajaInt);
                if (!$stmtDelete->execute()) {
                    $stmtDelete->close();
                    throw new Exception('No se pudieron limpiar las asignaciones previas');
                }
            }
            $stmtDelete->close();
        }

        // Ubicación física del póster (nombre_espacio + #número, o "sin ubicar todavía")
        $infoUbicacion = rh_ubicacion_poster($conexion, $id_poster);
        $textoUbicacion = $infoUbicacion['etiqueta']; // ej. "Piso 1 #3" o "sin ubicar todavía"

        // 2. Insertar únicamente las nuevas asignaciones (altas) y preparar sus correos
        $notificaciones = [];
        if (!empty($altasIds)) {
            $insertSql = "INSERT INTO asignaciones_evaluadores (id_poster, id_evaluador, id_ronda) VALUES (?, ?, ?)";
            $stmtInsert = $conexion->prepare($insertSql);
            if (!$stmtInsert) throw new Exception('No se pudo preparar la inserción de asignaciones');

            $sqlEvalInfo = "SELECT CONCAT(nombres, ' ', apellidos) AS nombre_evaluador, correo FROM usuario WHERE id = ?";
            $stmtEvalInfo = $conexion->prepare($sqlEvalInfo);

            foreach ($altasIds as $id_evaluador) {
                $id_ev = intval($id_evaluador);
                $stmtInsert->bind_param("iii", $id_poster, $id_ev, $id_ronda_asig);
                if (!$stmtInsert->execute()) {
                    throw new Exception('No se pudo asignar el evaluador ' . $id_ev);
                }

                // Recoger datos para notificar solo a los evaluadores nuevos
                $stmtEvalInfo->bind_param("i", $id_ev);
                $stmtEvalInfo->execute();
                $resEval = $stmtEvalInfo->get_result();
                if ($rowEval = $resEval->fetch_assoc()) {
                    $nombreEvEsc = rh_escapar($rowEval['nombre_evaluador']);
                    $tituloEsc = rh_escapar($tituloPoster);
                    $ubicEsc = rh_escapar($textoUbicacion);
                    $numRonda = intval($rondaCtx['numero'] ?: 1);

                    $cuerpoHtml = "
                        <p>¡Hola, <strong>{$nombreEvEsc}</strong>!</p>
                        <p>Se te ha asignado un póster para su evaluación en la plataforma:</p>
                        <ul style='line-height:1.8;'>
                            <li><strong>Póster:</strong> {$tituloEsc}</li>
                            <li><strong>Ubicación física:</strong> {$ubicEsc}</li>
                            <li><strong>Ronda:</strong> Ronda {$numRonda}</li>
                        </ul>
                        <p>Por favor ingresa al sistema en tu panel de evaluador para revisarlo y registrar tu calificación.</p>
                    ";

                    $notificaciones[] = [
                        'correo' => $rowEval['correo'],
                        'asunto' => "Nuevo póster asignado para evaluación: {$tituloPoster}",
                        'mensaje' => rh_plantilla_correo('Nuevo póster asignado para evaluación', $cuerpoHtml)
                    ];
                }
            }
            $stmtInsert->close();
            $stmtEvalInfo->close();
        }

        $conexion->commit();

        $respAsignar = [
            'success' => true,
            'message' => 'Asignación de evaluadores actualizada correctamente',
            'data' => [
                'id_ronda' => $id_ronda_asig,
                'evaluadores_nuevos' => count($notificaciones),
                'evaluadores_eliminados' => count($bajasIds),
                'ubicacion' => $textoUbicacion
            ]
        ];

        // Responder primero; correos en procesos de fondo (no bloquean la UI)
        if (ob_get_length()) {
            ob_clean();
        }
        echo json_encode($respAsignar);

        foreach ($notificaciones as $n) {
            encolarCorreoFondo($n['correo'], $n['asunto'], $n['mensaje']);
        }
        return;

    } catch (Exception $e) {
        $conexion->rollback();
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar asignación: ' . $e->getMessage()
        ]);
    }
}
?>