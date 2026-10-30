<?php
// backend/api/includes/Env.php — carga backend/.env (o raíz) una sola vez.
// Orden de precedencia: getenv / $_SERVER / $_ENV / archivo .env.

// Configurar zona horaria oficial de Colombia (UTC-5)
date_default_timezone_set('America/Bogota');

function app_env_archivo()
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    $rutas = [
        __DIR__ . '/../../.env',   // backend/.env
        __DIR__ . '/../../../.env', // repo/.env
    ];
    foreach ($rutas as $ruta) {
        if (!is_readable($ruta)) continue;
        $lineas = @file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lineas)) continue;
        foreach ($lineas as $linea) {
            $linea = trim($linea);
            if ($linea === '' || $linea[0] === '#' || strpos($linea, '=') === false) continue;
            list($k, $v) = explode('=', $linea, 2);
            $cache[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
        }
        break;
    }
    return $cache;
}

function app_env($clave, $porDefecto = null)
{
    $v = getenv($clave);
    if ($v !== false && $v !== '') return $v;
    if (isset($_SERVER[$clave]) && $_SERVER[$clave] !== '') return $_SERVER[$clave];
    if (isset($_ENV[$clave]) && $_ENV[$clave] !== '') return $_ENV[$clave];
    $archivo = app_env_archivo();
    if (isset($archivo[$clave]) && $archivo[$clave] !== '') return $archivo[$clave];
    return $porDefecto;
}
