<?php
// includes/Auth.php — Autenticación stateless con tokens HMAC (sin cambios de BD).
// Uso:
//   require_once __DIR__ . '/includes/Auth.php';
//   cors_headers("POST, GET, OPTIONS");
//   $auth = require_role([3, 4]); // 1=usuario 2=evaluador 3=admin 4=superadmin
//   // $auth = ['id'=>..., 'rol'=>...] verificado desde el token.

function auth_secret() {
    // En producción define AUTH_SECRET en el entorno / Apache. Fallback solo para dev.
    $s = getenv('AUTH_SECRET');
    if (!$s && isset($_SERVER['AUTH_SECRET'])) $s = $_SERVER['AUTH_SECRET'];
    return $s ? $s : 'REMOVED_SECRET';
}

function auth_b64url_encode($bin) {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
function auth_b64url_decode($str) {
    $pad = strlen($str) % 4;
    if ($pad) $str .= str_repeat('=', 4 - $pad);
    $bin = base64_decode(strtr($str, '-_', '+/'), true);
    return $bin === false ? null : $bin;
}

function auth_issue_token($userId, $rol, $ttl = 43200) {
    $payload = json_encode([
        'id' => (int)$userId,
        'rol' => (int)$rol,
        'exp' => time() + (int)$ttl,
    ]);
    $b = auth_b64url_encode($payload);
    $sig = auth_b64url_encode(hash_hmac('sha256', $b, auth_secret(), true));
    return $b . '.' . $sig;
}

function auth_verify_token($token) {
    if (!is_string($token) || strpos($token, '.') === false) return null;
    list($b, $sig) = explode('.', $token, 2);
    $expect = auth_b64url_encode(hash_hmac('sha256', $b, auth_secret(), true));
    if (!hash_equals($expect, $sig)) return null;
    $raw = auth_b64url_decode($b);
    if ($raw === null) return null;
    $p = json_decode($raw, true);
    if (!is_array($p) || empty($p['id']) || !isset($p['rol']) || empty($p['exp'])) return null;
    if ((int)$p['exp'] < time()) return null;
    return ['id' => (int)$p['id'], 'rol' => (int)$p['rol']];
}

// Extrae el token: header Authorization Bearer, X-Auth-Token, ?auth_token=, $_POST['auth_token'] o body.auth_token
function auth_current() {
    $token = null;
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $norm = [];
    foreach ($headers as $k => $v) $norm[strtolower($k)] = $v;
    if (empty($norm['authorization']) && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $norm['authorization'] = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (empty($norm['authorization']) && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $norm['authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (!empty($norm['authorization']) && stripos($norm['authorization'], 'bearer ') === 0) {
        $token = trim(substr($norm['authorization'], 7));
    } elseif (!empty($norm['x-auth-token'])) {
        $token = trim($norm['x-auth-token']);
    } elseif (!empty($_GET['auth_token'])) {
        $token = trim($_GET['auth_token']);
    } elseif (!empty($_POST['auth_token'])) {
        $token = trim($_POST['auth_token']);
    }
    if (!$token) {
        // Intentar leerlo del body JSON sin consumirlo dos veces (php://input es re-leíble)
        $raw = @file_get_contents('php://input');
        if ($raw) {
            $j = json_decode($raw, true);
            if (is_array($j) && !empty($j['auth_token'])) $token = trim($j['auth_token']);
        }
    }
    if (!$token) return null;
    return auth_verify_token($token);
}

function auth_deny($code, $msg) {
    http_response_code($code);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "error", "success" => false, "message" => $msg]);
    exit;
}

// Exige login; opcionalmente exige uno de los roles. Superadmin (rol 4) pasa siempre.
function auth_es_superadmin($rol = null) {
    if ($rol === null) {
        $curr = auth_current();
        $rol = $curr ? (int)$curr['rol'] : 0;
    }
    return ((int)$rol === 4);
}

/**
 * Si el usuario autenticado es un Administrador (id_rol = 3), devuelve el id_evento
 * que tiene asignado para administrar (o el evento activo de su carrera como respaldo).
 * Si es Super Admin (id_rol = 4) u otro rol, devuelve null (sin restricción de evento).
 */
function auth_id_evento_admin($conexion, $auth = null) {
    if ($auth === null) $auth = auth_current();
    if (!$auth || (int)($auth['rol'] ?? 0) !== 3) {
        return null;
    }
    $userId = (int)($auth['id'] ?? 0);
    if ($userId <= 0) return null;

    $stmt = $conexion->prepare("SELECT id_evento, carrera FROM usuario WHERE id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        if ($row) {
            if (!empty($row['id_evento']) && (int)$row['id_evento'] > 0) {
                return (int)$row['id_evento'];
            }
            $c = mb_strtolower(trim((string)($row['carrera'] ?? '')), 'UTF-8');
            $cNorm = (strpos($c, 'civil') !== false) ? 'civil' : 'sistemas';
            $stmtEv = $conexion->prepare("SELECT id_evento FROM eventos WHERE activo = 1 AND (carrera = ? OR carrera = 'ambas') ORDER BY (carrera = ?) DESC, id_evento ASC LIMIT 1");
            if ($stmtEv) {
                $stmtEv->bind_param("ss", $cNorm, $cNorm);
                $stmtEv->execute();
                $resEv = $stmtEv->get_result();
                $rowEv = $resEv ? $resEv->fetch_assoc() : null;
                $stmtEv->close();
                if ($rowEv && !empty($rowEv['id_evento'])) {
                    return (int)$rowEv['id_evento'];
                }
            }
        }
    }
    $resDef = $conexion->query("SELECT id_evento FROM eventos WHERE activo = 1 ORDER BY id_evento ASC LIMIT 1");
    if ($resDef && ($rowDef = $resDef->fetch_assoc())) {
        return (int)$rowDef['id_evento'];
    }
    return 1;
}

function require_role($roles = null) {
    $auth = auth_current();
    if (!$auth) auth_deny(401, "No autenticado. Inicia sesión.");
    if (is_array($roles) && count($roles) > 0) {
        if ((int)$auth['rol'] === 4) return $auth; // superadmin bypass
        if (!in_array($auth['rol'], $roles, true)) {
            auth_deny(403, "Sin permiso para esta operación.");
        }
    }
    return $auth;
}
function require_login() { return require_role(null); }

// CORS común: mantiene compatibilidad con Vite en localhost y permite el header del token.
function cors_headers($methods = "POST, GET, PUT, DELETE, OPTIONS") {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");
    header("Access-Control-Allow-Methods: " . $methods);
    header("Content-Type: application/json; charset=UTF-8");
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

// Rate-limit simple por IP en /tmp (anti fuerza-bruta). 10 intentos / 5 min.
function auth_rate_limit($key, $max = 10, $window = 300) {
    $file = sys_get_temp_dir() . '/ratelimit_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    $now = time();
    $data = ['hits' => []];
    if (is_file($file)) {
        $j = json_decode(@file_get_contents($file), true);
        if (is_array($j) && isset($j['hits'])) $data = $j;
    }
    $data['hits'] = array_values(array_filter($data['hits'], function ($t) use ($now, $window) {
        return ($now - (int)$t) < $window;
    }));
    if (count($data['hits']) >= $max) return false;
    $data['hits'][] = $now;
    @file_put_contents($file, json_encode($data));
    return true;
}
?>
