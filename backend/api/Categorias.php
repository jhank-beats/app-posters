<?php
require_once __DIR__ . '/includes/Auth.php';
cors_headers("POST, GET, PUT, DELETE, OPTIONS");

include '../Conexion.php';

function cat_asegurar_columna_y_semilla($conexion) {
    static $listo = false;
    if ($listo) return;

    $col = $conexion->query("SHOW COLUMNS FROM `categorias` LIKE 'carrera'");
    if ($col && $col->num_rows === 0) {
        $conexion->query("ALTER TABLE `categorias` ADD COLUMN `carrera` VARCHAR(20) NOT NULL DEFAULT 'sistemas' AFTER `nombre_categorias`, ADD KEY `idx_carrera_cat` (`carrera`)");
    }

    // Asegurar que Ingeniería Civil tenga su propio conjunto independiente de categorías iniciales
    $resCiv = $conexion->query("SELECT COUNT(*) AS total FROM `categorias` WHERE `carrera` = 'civil'");
    $totalCiv = $resCiv ? intval($resCiv->fetch_assoc()['total']) : 0;
    if ($totalCiv === 0) {
        $categoriasCivilIniciales = [
            'Estructuras y Materiales',
            'Geotecnia y Suelos',
            'Hidráulica y Recursos Hídricos',
            'Vías y Transporte',
            'Construcción y Gerencia de Obra',
            'Cálculo y Modelación',
        ];
        $stmtSeed = $conexion->prepare("INSERT INTO `categorias` (`nombre_categorias`, `carrera`, `activo`) VALUES (?, 'civil', 1)");
        if ($stmtSeed) {
            foreach ($categoriasCivilIniciales as $nomCat) {
                $stmtSeed->bind_param("s", $nomCat);
                $stmtSeed->execute();
            }
            $stmtSeed->close();
        }
    }

    $listo = true;
}

function cat_normalizar_carrera($valor) {
    $c = mb_strtolower(trim((string)$valor), 'UTF-8');
    if (strpos($c, 'civil') !== false) return 'civil';
    if ($c === 'ambas' || $c === 'todas') return 'todas';
    return 'sistemas';
}

function cat_carrera_usuario_autenticado($conexion, $auth) {
    if (!$auth) return null;
    $rol = intval($auth['rol'] ?? 0);
    if ($rol === 3) {
        $cAdm = auth_carrera_admin($conexion, $auth);
        return ($cAdm === 'civil') ? 'civil' : 'sistemas';
    }
    if ($rol === 4) {
        return null; // Super Admin puede ver/gestionar ambas carreras por separado
    }
    $uid = intval($auth['id'] ?? 0);
    if ($uid > 0) {
        $stmt = $conexion->prepare("SELECT carrera FROM usuario WHERE id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("i", $uid);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($row && !empty($row['carrera'])) {
                return (strpos(mb_strtolower($row['carrera'], 'UTF-8'), 'civil') !== false) ? 'civil' : 'sistemas';
            }
        }
    }
    return 'sistemas';
}

cat_asegurar_columna_y_semilla($conexion);

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        traerCategorias();
        break;
    case 'PUT':
        $auth = require_role([3, 4]);
        modificarCategorias($auth);
        break;
    case 'DELETE':
        $auth = require_role([3, 4]);
        eliminarCategorias($auth);
        break;
    case 'POST':
        $auth = require_role([3, 4]);
        crearCategorias($auth);
        break;
}

function traerCategorias() {
    global $conexion;

    $curr = auth_current();
    $rolActual = $curr ? intval($curr['rol'] ?? 0) : 0;

    // Si es Admin de carrera (rol 3), SIEMPRE ve solo las categorías de su propia carrera
    $carreraFiltro = null;
    if ($rolActual === 3) {
        $carreraFiltro = cat_carrera_usuario_autenticado($conexion, $curr);
    } elseif (isset($_GET['carrera']) && trim((string)$_GET['carrera']) !== '') {
        $cParam = cat_normalizar_carrera($_GET['carrera']);
        $carreraFiltro = ($cParam === 'todas') ? null : $cParam;
    } elseif ($curr && in_array($rolActual, [1, 2], true)) {
        $carreraFiltro = cat_carrera_usuario_autenticado($conexion, $curr);
    }

    if ($carreraFiltro !== null) {
        $sql = "SELECT id_categorias, nombre_categorias, carrera, activo, fecha_registro_categorias
                FROM categorias
                WHERE activo = 1 AND carrera = ?
                ORDER BY nombre_categorias ASC";
        $stmt = $conexion->prepare($sql);
        $stmt->bind_param("s", $carreraFiltro);
        $stmt->execute();
        $resultado = $stmt->get_result();
    } else {
        $sql = "SELECT id_categorias, nombre_categorias, carrera, activo, fecha_registro_categorias
                FROM categorias
                WHERE activo = 1
                ORDER BY carrera ASC, nombre_categorias ASC";
        $resultado = $conexion->query($sql);
    }

    if (!$resultado) {
        error_log('Categorias: ' . $conexion->error);
        echo json_encode([
            'success' => false,
            'message' => 'No se pudieron cargar las categorías.'
        ]);
        return;
    }

    $categorias = [];
    while($row = $resultado->fetch_assoc()) {
        $row['carrera'] = ($row['carrera'] ?? 'sistemas') === 'civil' ? 'civil' : 'sistemas';
        $categorias[] = $row;
    }
    if (isset($stmt) && $stmt) $stmt->close();

    echo json_encode([
        'success' => true,
        'data' => $categorias
    ]);
}

function crearCategorias($auth) {
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $nombre = trim((string)($data['nombre_categorias'] ?? ''));
    if ($nombre === '') {
        echo json_encode(["success" => false, "message" => "El nombre de la categoría es obligatorio"]);
        return;
    }

    $carreraAdmin = cat_carrera_usuario_autenticado($conexion, $auth);
    if ($carreraAdmin !== null) {
        $carrera = $carreraAdmin;
    } else {
        $cReq = cat_normalizar_carrera($data['carrera'] ?? 'sistemas');
        $carrera = ($cReq === 'civil') ? 'civil' : 'sistemas';
    }

    $sql = "INSERT INTO categorias (nombre_categorias, carrera, activo) VALUES (?, ?, 1)";
    $sentencia = $conexion->prepare($sql);
    $sentencia->bind_param("ss", $nombre, $carrera);

    if ($sentencia->execute()) {
        echo json_encode([
            "success" => true,
            "id_categorias" => intval($conexion->insert_id),
            "message" => "Categoría creada correctamente",
            "carrera" => $carrera
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Error al crear categoría"
        ]);
    }
}

function modificarCategorias($auth) {
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);

    $id = intval($data['id_categorias'] ?? 0);
    $nombre = trim((string)($data['nombre_categorias'] ?? ''));
    if ($id <= 0 || $nombre === '') {
        echo json_encode(["success" => false, "message" => "Datos de categoría inválidos"]);
        return;
    }

    $carreraAdmin = cat_carrera_usuario_autenticado($conexion, $auth);
    if ($carreraAdmin !== null) {
        // Admin de carrera solo puede modificar categorías de su propia carrera
        $sql = "UPDATE categorias SET nombre_categorias = ? WHERE id_categorias = ? AND carrera = ?";
        $sentencia = $conexion->prepare($sql);
        $sentencia->bind_param("sis", $nombre, $id, $carreraAdmin);
    } else {
        $cReq = isset($data['carrera']) ? cat_normalizar_carrera($data['carrera']) : null;
        if ($cReq === 'civil' || $cReq === 'sistemas') {
            $sql = "UPDATE categorias SET nombre_categorias = ?, carrera = ? WHERE id_categorias = ?";
            $sentencia = $conexion->prepare($sql);
            $sentencia->bind_param("ssi", $nombre, $cReq, $id);
        } else {
            $sql = "UPDATE categorias SET nombre_categorias = ? WHERE id_categorias = ?";
            $sentencia = $conexion->prepare($sql);
            $sentencia->bind_param("si", $nombre, $id);
        }
    }

    if ($sentencia->execute()) {
        if ($carreraAdmin !== null && $sentencia->affected_rows === 0) {
            // Verificar si existía en otra carrera
            $stmtChk = $conexion->prepare("SELECT carrera FROM categorias WHERE id_categorias = ? LIMIT 1");
            $stmtChk->bind_param("i", $id);
            $stmtChk->execute();
            $rowChk = $stmtChk->get_result()->fetch_assoc();
            $stmtChk->close();
            if ($rowChk && $rowChk['carrera'] !== $carreraAdmin) {
                http_response_code(403);
                echo json_encode(["success" => false, "message" => "Solo puedes modificar categorías de tu carrera."]);
                return;
            }
        }
        echo json_encode([
            "success" => true,
            "message" => "Categoría modificada"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Error al modificar"
        ]);
    }
}

function eliminarCategorias($auth) {
    global $conexion;

    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);

    $carreraAdmin = cat_carrera_usuario_autenticado($conexion, $auth);
    if ($carreraAdmin !== null) {
        $sql = "UPDATE categorias SET activo = 0 WHERE id_categorias = ? AND carrera = ?";
        $sentencia = $conexion->prepare($sql);
        $sentencia->bind_param('is', $id, $carreraAdmin);
    } else {
        $sql = "UPDATE categorias SET activo = 0 WHERE id_categorias = ?";
        $sentencia = $conexion->prepare($sql);
        $sentencia->bind_param('i', $id);
    }

    if ($sentencia->execute()) {
        if ($carreraAdmin !== null && $sentencia->affected_rows === 0) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Solo puedes eliminar categorías de tu carrera.'
            ]);
            return;
        }
        echo json_encode([
            'success' => true,
            'message' => 'Categoría eliminada correctamente'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Error al eliminar categoría'
        ]);
    }
}
?>