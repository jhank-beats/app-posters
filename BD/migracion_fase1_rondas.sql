-- =====================================================================
-- BD/migracion_fase1_rondas.sql — FASE 1: estabilizar rondas
-- IDEMPOTENTE: se puede ejecutar varias veces sin romper nada, y también
-- sobre una BD que no tenga las tablas de rondas (no hace nada y sale).
--   mysql -u <usuario> -p posters < BD/migracion_fase1_rondas.sql
--
-- IMPORTANTE: si montas una BD desde cero, usa `BD/migracion_rondas.sql`
-- (ya trae `corte_confirmado` en el CREATE TABLE). Este archivo es SOLO
-- para actualizar una BD existente que fue creada antes de la Fase 1.
--
-- Contenido:
--   1) rondas.corte_confirmado TINYINT(1) DEFAULT 0
--   2) Backfill: rondas cerradas que ya tienen ronda siguiente con selecciones
--   3) Índice (id_ronda, id_poster) en asignaciones_evaluadores
-- =====================================================================

-- 0) Existe la tabla `rondas`? Si no, no hay nada que migrar.
SET @tabla_rondas := (SELECT COUNT(*) FROM information_schema.TABLES
                      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rondas');

-- 1) Columna corte_confirmado en rondas
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rondas'
                  AND COLUMN_NAME = 'corte_confirmado');
SET @sql := IF(@tabla_rondas > 0 AND @existe = 0,
  'ALTER TABLE rondas ADD COLUMN corte_confirmado TINYINT(1) NOT NULL DEFAULT 0 AFTER estado',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- 2) Las rondas cerradas que ya tienen una ronda siguiente con selecciones
--    se marcan como corte confirmado (repara el histórico del bug §3).
SET @tabla_sel := (SELECT COUNT(*) FROM information_schema.TABLES
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selecciones');
SET @sql := IF(@tabla_rondas > 0 AND @tabla_sel > 0,
  'UPDATE rondas r SET r.corte_confirmado = 1
   WHERE r.estado = ''cerrada''
     AND EXISTS (SELECT 1 FROM rondas sig
                 JOIN selecciones s ON s.id_ronda = sig.id_ronda
                 WHERE sig.id_evento = r.id_evento AND sig.numero = r.numero + 1)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- 3) Índice para acelerar asignaciones por (id_ronda, id_poster)
SET @tabla_asig := (SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones_evaluadores');
SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones_evaluadores'
                  AND INDEX_NAME = 'idx_asig_ronda_poster');
SET @sql := IF(@tabla_asig > 0 AND @existe = 0,
  'ALTER TABLE asignaciones_evaluadores ADD KEY idx_asig_ronda_poster (id_ronda, id_poster)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Verificación
SELECT id_ronda, numero, nombre, estado, corte_confirmado FROM rondas ORDER BY id_evento, numero;
