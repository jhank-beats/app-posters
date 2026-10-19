-- =====================================================================
-- BD/migracion_fase2_posters.sql — FASE 2: formulario de subir póster
-- IDEMPOTENTE: se puede ejecutar varias veces sin romper nada.
--   mysql -u <usuario> -p posters < BD/migracion_fase2_posters.sql
--
-- Contenido:
--   1) Tabla puente `poster_profesores` (id_poster, id_usuario, materia)
--   2) Columna `id_evento` en `cargar_posters` (si no existe) + backfill
--   3) Columna `hash_archivo CHAR(64)` en `cargar_posters` + índice
-- =====================================================================

-- 1) Tabla puente `poster_profesores`
CREATE TABLE IF NOT EXISTS poster_profesores (
  id INT(11) NOT NULL AUTO_INCREMENT,
  id_poster INT(11) NOT NULL,
  id_usuario INT(11) NOT NULL,
  materia VARCHAR(160) NOT NULL DEFAULT '',
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_poster_profesor_materia (id_poster, id_usuario, materia),
  KEY idx_pp_poster (id_poster),
  KEY idx_pp_usuario (id_usuario),
  CONSTRAINT fk_pp_poster FOREIGN KEY (id_poster) REFERENCES cargar_posters (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pp_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Verificar/crear columna `id_evento` en `cargar_posters`
SET @tabla_posters := (SELECT COUNT(*) FROM information_schema.TABLES
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargar_posters');

SET @existe_ev := (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargar_posters'
                     AND COLUMN_NAME = 'id_evento');
SET @sql := IF(@tabla_posters > 0 AND @existe_ev = 0,
  'ALTER TABLE cargar_posters ADD COLUMN id_evento INT(11) DEFAULT NULL',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Rellenar pósters huérfanos de evento con el evento activo (o el 1)
SET @ev_activo := COALESCE(
  (SELECT id_evento FROM eventos WHERE activo = 1 LIMIT 1),
  (SELECT id_evento FROM eventos ORDER BY id_evento ASC LIMIT 1),
  1
);
UPDATE cargar_posters SET id_evento = @ev_activo WHERE id_evento IS NULL;

-- 3) Añadir columna `hash_archivo CHAR(64)` a `cargar_posters`
SET @existe_hash := (SELECT COUNT(*) FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargar_posters'
                       AND COLUMN_NAME = 'hash_archivo');
SET @sql := IF(@tabla_posters > 0 AND @existe_hash = 0,
  'ALTER TABLE cargar_posters ADD COLUMN hash_archivo CHAR(64) DEFAULT NULL',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargar_posters'
                      AND INDEX_NAME = 'idx_posters_hash');
SET @sql := IF(@tabla_posters > 0 AND @existe_idx = 0,
  'ALTER TABLE cargar_posters ADD KEY idx_posters_hash (hash_archivo)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;
