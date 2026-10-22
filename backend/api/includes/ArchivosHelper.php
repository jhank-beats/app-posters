<?php
// backend/api/includes/ArchivosHelper.php
// Contrato único de almacenamiento y URL de pósters.
// - En disco: UPLOAD_DIR (fuera del checkout de git en producción).
// - En BD: solo la clave del archivo (nombre aleatorio + extensión).
// - En URL: PUBLIC_FILES_URL + clave.

function archivos_env($clave, $porDefecto = null)
{
    $v = getenv($clave);
    if ($v !== false && $v !== '') return $v;
    if (isset($_ENV[$clave]) && $_ENV[$clave] !== '') return $_ENV[$clave];
    if (isset($_SERVER[$clave]) && $_SERVER[$clave] !== '') return $_SERVER[$clave];
    return $porDefecto;
}

/** Directorio absoluto donde se guardan los archivos. */
function archivos_dir()
{
    $dir = archivos_env('UPLOAD_DIR');
    if ($dir === null || $dir === '') {
        $dir = __DIR__ . '/../../imgPosters';
    }
    return rtrim($dir, '/');
}

/** Prefijo público bajo el que se sirve archivos_dir(). */
function archivos_url_base()
{
    $base = archivos_env('PUBLIC_FILES_URL', '/imgPosters');
    return rtrim($base, '/');
}

/** URL pública de una clave de archivo (acepta rutas legacy con prefijos). */
function archivo_url($ruta)
{
    $clave = archivo_clave($ruta);
    if ($clave === null || $clave === '') return null;
    return archivos_url_base() . '/' . rawurlencode($clave);
}

/**
 * Extrae la clave de archivo desde cualquier forma legacy:
 * 'src/assets/imgPosters/foo.pdf', 'imgPosters/foo.pdf', 'foo.pdf', 'http://...'
 */
function archivo_clave($ruta)
{
    if (!is_string($ruta) || trim($ruta) === '') return null;
    $ruta = trim($ruta);
    if (strpos($ruta, 'http://') === 0 || strpos($ruta, 'https://') === 0) {
        $parsed = parse_url($ruta, PHP_URL_PATH);
        $ruta = is_string($parsed) ? $parsed : $ruta;
    }
    $nombre = basename($ruta);
    return $nombre === '' || $nombre === '.' || $nombre === '..' ? null : $nombre;
}

/** Ruta absoluta en disco de una clave. */
function archivo_path($ruta)
{
    $clave = archivo_clave($ruta);
    if ($clave === null) return null;
    return archivos_dir() . '/' . $clave;
}

/** URL pública de la miniatura de una clave (si existe se usa en listados). */
function archivo_url_thumb($ruta)
{
    $clave = archivo_clave($ruta);
    if ($clave === null) return null;
    $ext = strtolower(pathinfo($clave, PATHINFO_EXTENSION));
    if ($ext !== 'jpg' && $ext !== 'jpeg' && $ext !== 'png') {
        return archivo_url($ruta);
    }
    $base = pathinfo($clave, PATHINFO_FILENAME);
    $thumb = ($ext === 'png') ? ('thumb_' . $base . '.png') : ('thumb_' . $base . '.jpg');
    if (is_file(archivos_dir() . '/' . $thumb)) {
        return archivos_url_base() . '/' . rawurlencode($thumb);
    }
    return archivo_url($ruta);
}

/** Extensiones permitidas para pósters. */
function archivos_extensiones_permitidas()
{
    return ['pdf', 'png', 'jpg', 'jpeg'];
}

/** MIME permitidos (finfo). */
function archivos_mimes_permitidos()
{
    return [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
    ];
}

/**
 * Valida extensión + MIME real. Devuelve ['ok'=>bool,'ext'=>?string,'error'=>?string]
 */
function archivos_validar_subida($rutaTemporal, $nombreOriginal, $maxBytes = 10485760)
{
    $ext = strtolower(pathinfo((string)$nombreOriginal, PATHINFO_EXTENSION));
    if (!in_array($ext, archivos_extensiones_permitidas(), true)) {
        return ['ok' => false, 'ext' => null, 'error' => 'Tipo de archivo no permitido. Usa PDF, PNG o JPG.'];
    }
    if (!is_file($rutaTemporal)) {
        return ['ok' => false, 'ext' => null, 'error' => 'Archivo temporal inválido.'];
    }
    $tam = filesize($rutaTemporal);
    if ($tam === false || $tam <= 0) {
        return ['ok' => false, 'ext' => null, 'error' => 'Archivo vacío.'];
    }
    if ($maxBytes > 0 && $tam > $maxBytes) {
        $mb = round($maxBytes / 1048576, 1);
        return ['ok' => false, 'ext' => null, 'error' => "El archivo supera el tamaño máximo ({$mb} MB)."];
    }

    $mimeReal = null;
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mimeReal = finfo_file($finfo, $rutaTemporal);
            finfo_close($finfo);
        }
    }
    if ($mimeReal === null && function_exists('mime_content_type')) {
        $mimeReal = mime_content_type($rutaTemporal);
    }

    $permitidos = archivos_mimes_permitidos();
    $esperado = $permitidos[$ext];
    if ($mimeReal !== null && $mimeReal !== $esperado) {
        // JPG a veces reporta image/pjpeg; aceptar variantes comunes.
        $alias = ['image/pjpeg' => 'image/jpeg', 'image/x-png' => 'image/png'];
        $mimeNorm = isset($alias[$mimeReal]) ? $alias[$mimeReal] : $mimeReal;
        if ($mimeNorm !== $esperado) {
            return ['ok' => false, 'ext' => null, 'error' => 'El contenido del archivo no coincide con su extensión.'];
        }
    }

    return ['ok' => true, 'ext' => $ext, 'error' => null];
}

/** Genera una clave aleatoria + extensión. */
function archivos_nueva_clave($ext)
{
    return bin2hex(random_bytes(16)) . '.' . $ext;
}

/** Crea UPLOAD_DIR con permisos seguros si no existe. */
function archivos_asegurar_dir()
{
    $dir = archivos_dir();
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

/**
 * Genera una miniatura JPEG (~200px) de una imagen. Devuelve la clave de la miniatura o null.
 * Solo imágenes (jpg/png); PDF se sirve original. Si falla, no rompe la subida.
 */
function archivos_generar_miniatura($claveOriginal, $max = 200)
{
    if (!function_exists('imagecreatetruecolor')) return null;
    $path = archivo_path($claveOriginal);
    if (!$path || !is_file($path)) return null;
    $ext = strtolower(pathinfo($claveOriginal, PATHINFO_EXTENSION));
    if ($ext === 'jpg' || $ext === 'jpeg') {
        $src = @imagecreatefromjpeg($path);
    } elseif ($ext === 'png') {
        $src = @imagecreatefrompng($path);
    } else {
        return null;
    }
    if (!$src) return null;
    $w = imagesx($src);
    $h = imagesy($src);
    if ($w <= 0 || $h <= 0) {
        imagedestroy($src);
        return null;
    }
    $escala = min(1, $max / max($w, $h));
    $nw = max(1, (int)round($w * $escala));
    $nh = max(1, (int)round($h * $escala));
    $dst = imagecreatetruecolor($nw, $nh);
    if (!$dst) {
        imagedestroy($src);
        return null;
    }
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    $claveThumb = 'thumb_' . $claveOriginal;
    if (strtolower(pathinfo($claveOriginal, PATHINFO_EXTENSION)) === 'png') {
        $claveThumb = 'thumb_' . pathinfo($claveOriginal, PATHINFO_FILENAME) . '.png';
        $ok = @imagepng($dst, archivo_path($claveThumb));
    } else {
        $claveThumb = 'thumb_' . pathinfo($claveOriginal, PATHINFO_FILENAME) . '.jpg';
        $ok = @imagejpeg($dst, archivo_path($claveThumb), 82);
    }
    imagedestroy($src);
    imagedestroy($dst);
    return $ok ? $claveThumb : null;
}
