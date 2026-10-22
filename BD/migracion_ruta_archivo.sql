-- Migración: contrato único de archivo en cargar_posters.ruta_imagen
-- Guardar SOLO la clave (nombre.ext), no rutas legacy.
-- Ejecutar una sola vez. Idempotente.

UPDATE cargar_posters
SET ruta_imagen = SUBSTRING_INDEX(ruta_imagen, '/', -1)
WHERE ruta_imagen IS NOT NULL
  AND ruta_imagen <> ''
  AND ruta_imagen LIKE '%/%';

-- Índice para listados por espacio (H8)
-- (information_schema para no fallar si ya existe)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cargar_posters'
    AND INDEX_NAME = 'idx_poster_espacio_activo'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_poster_espacio_activo ON cargar_posters (id_espacio, activo)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
