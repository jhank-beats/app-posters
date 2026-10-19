-- =====================================================================
-- BD/migracion_rondas.sql
-- Rondas de evaluación y premios — app-posters (base `posters`)
--
-- CÓMO USARLO:
--   mysql -u <usuario> -p posters < BD/migracion_rondas.sql
--   (el usuario lo aplica a mano: en este proyecto NO hay sistema de migraciones)
--
-- PROPIEDADES:
--   * IDEMPOTENTE: se puede ejecutar dos veces sin romper nada. Cada bloque
--     pregunta antes en information_schema si la columna / índice / clave
--     foránea ya existe y solo ejecuta el ALTER cuando hace falta.
--   * CONSERVA LOS DATOS: no borra tablas ni filas. Los registros actuales de
--     `evaluaciones`, `evaluaciones_detalles` y `asignaciones_evaluadores` se
--     rellenan con id_ronda = la ronda 1 del evento del póster.
--   * SIN credenciales ni contraseñas de base de datos en este archivo.
--
-- NOTAS DE DISEÑO:
--   * `rondas` cuelga de `eventos` (cada evento tiene sus propias rondas), con
--     UNIQUE(id_evento, numero) para que mañana exista una ronda 3 sin migrar.
--   * La ronda 2+ SÍ usa `asignaciones_evaluadores`: al confirmar el corte
--     (accion `cerrar_y_pasar`) se reasignan evaluadores al azar, excluyendo
--     al autor del póster y a quien ya lo calificó en la ronda anterior
--     (Fase 1). La elegibilidad de cualquier ronda exige fila en esa tabla.
--   * NO se borran las columnas legacy `evaluaciones.calificacion_*`.
--   * `selecciones` guarda los pósters que pasan de ronda y, tras el podio,
--     su `lugar` y `premio`. Cada selección pertenece a la ronda a la que se
--     entra (el corte de la ronda 1 se guarda con id_ronda = ronda 2).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Rondas por evento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rondas (
  id_ronda INT(11) NOT NULL AUTO_INCREMENT,
  id_evento INT(11) NOT NULL,
  numero TINYINT(4) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  estado ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
  corte_confirmado TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = cerrada con corte confirmado
  fecha_inicio DATETIME DEFAULT NULL,
  fecha_cierre DATETIME DEFAULT NULL,
  cupos_seleccion SMALLINT(6) DEFAULT NULL,   -- NULL = sin límite
  premios SMALLINT(6) NOT NULL DEFAULT 3,
  creado_por INT(11) DEFAULT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_ronda),
  UNIQUE KEY unq_ronda_evento_numero (id_evento, numero),
  KEY ronda_estado (id_evento, estado),
  CONSTRAINT fk_ronda_evento FOREIGN KEY (id_evento) REFERENCES eventos (id_evento) ON DELETE CASCADE,
  CONSTRAINT fk_ronda_creador FOREIGN KEY (creado_por) REFERENCES usuario (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 2) Ronda 1 para los eventos que aún no tienen ninguna
--    (el evento activo arranca con datos utilizables; los demás eventos
--     reciben su ronda 1 para que las claves foráneas nunca queden rotas).
--    Es un INSERT condicional: dos ejecuciones seguidas no duplican nada.
-- ---------------------------------------------------------------------
INSERT INTO rondas (id_evento, numero, nombre, estado, premios)
SELECT e.id_evento, 1, 'Ronda 1 · Exposición en mesa', 'abierta', 3
FROM eventos e
WHERE NOT EXISTS (
    SELECT 1 FROM rondas r WHERE r.id_evento = e.id_evento AND r.numero = 1
);


-- ---------------------------------------------------------------------
-- 3) Criterios por ronda (los criterios actuales pasan a la ronda 1)
--    Se agrega la columna SIN clave foránea, se rellena y solo entonces se
--    crea la FK: así el DEFAULT 1 no rompe filas antiguas si el id de la
--    ronda 1 no fuera 1.
-- ---------------------------------------------------------------------
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'criterios_evaluacion'
                  AND COLUMN_NAME = 'id_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE criterios_evaluacion ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Corrección de huérfanos: si un criterio quedó apuntando a una ronda que no
-- existe (por ejemplo cuando la ronda 1 no tiene id 1), se le asigna la ronda 1
-- del evento activo. El resto de filas conserva su valor.
SET @ronda_activa := (SELECT r.id_ronda FROM rondas r
                      JOIN eventos ev ON ev.id_evento = r.id_evento
                      WHERE ev.activo = 1 AND r.numero = 1 LIMIT 1);
UPDATE criterios_evaluacion c
SET c.id_ronda = @ronda_activa
WHERE @ronda_activa IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM rondas r2 WHERE r2.id_ronda = c.id_ronda);

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'criterios_evaluacion'
                  AND INDEX_NAME = 'fk_criterio_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE criterios_evaluacion ADD KEY fk_criterio_ronda (id_ronda)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'criterios_evaluacion'
                  AND CONSTRAINT_NAME = 'fk_criterio_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE criterios_evaluacion ADD CONSTRAINT fk_criterio_ronda FOREIGN KEY (id_ronda) REFERENCES rondas (id_ronda) ON DELETE CASCADE',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- ---------------------------------------------------------------------
-- 4) Evaluaciones con ronda (se rompe el UNIQUE actual para poder evaluar
--    el mismo póster en dos rondas distintas)
-- ---------------------------------------------------------------------
-- 4.1 columna id_ronda
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones'
                  AND COLUMN_NAME = 'id_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id_poster',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- 4.2 relleno de los registros existentes: ronda 1 del evento del póster.
--     Solo se ejecuta en la misma corrida en la que se creó la columna, para
--     no pisar evaluaciones que ya pertenezcan a la ronda 2.
SET @sql := IF(@existe = 0,
  'UPDATE evaluaciones e JOIN cargar_posters p ON p.id = e.id_poster JOIN rondas r ON r.id_evento = p.id_evento AND r.numero = 1 SET e.id_ronda = r.id_ronda',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- 4.3 índices y clave foránea.
--     IMPORTANTE: el índice único nuevo se crea ANTES de borrar el antiguo
--     `id_poster`, porque InnoDB lo necesita para la FK sobre id_poster.
SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones'
                  AND INDEX_NAME = 'unq_eval_poster_evaluador_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones ADD UNIQUE KEY unq_eval_poster_evaluador_ronda (id_poster, id_evaluador, id_ronda)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones'
                  AND INDEX_NAME = 'id_poster');
SET @sql := IF(@existe > 0, 'ALTER TABLE evaluaciones DROP INDEX id_poster', 'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones'
                  AND INDEX_NAME = 'unq_eval_poster_evaluador_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones ADD UNIQUE KEY unq_eval_poster_evaluador_ronda (id_poster, id_evaluador, id_ronda)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones'
                  AND INDEX_NAME = 'idx_eval_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones ADD KEY idx_eval_ronda (id_ronda)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones'
                  AND CONSTRAINT_NAME = 'fk_eval_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones ADD CONSTRAINT fk_eval_ronda FOREIGN KEY (id_ronda) REFERENCES rondas (id_ronda) ON DELETE CASCADE',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- ---------------------------------------------------------------------
-- 5) Detalle de evaluaciones con ronda
-- ---------------------------------------------------------------------
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones_detalles'
                  AND COLUMN_NAME = 'id_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones_detalles ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id_poster',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql := IF(@existe = 0,
  'UPDATE evaluaciones_detalles d JOIN cargar_posters p ON p.id = d.id_poster JOIN rondas r ON r.id_evento = p.id_evento AND r.numero = 1 SET d.id_ronda = r.id_ronda',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones_detalles'
                  AND INDEX_NAME = 'uniq_detalle');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones_detalles ADD UNIQUE KEY uniq_detalle (id_poster, id_evaluador, id_ronda, id_criterio)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones_detalles'
                  AND INDEX_NAME = 'evaluacion_unica');
SET @sql := IF(@existe > 0, 'ALTER TABLE evaluaciones_detalles DROP INDEX evaluacion_unica', 'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluaciones_detalles'
                  AND INDEX_NAME = 'idx_detalle_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE evaluaciones_detalles ADD KEY idx_detalle_ronda (id_ronda)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- ---------------------------------------------------------------------
-- 6) Asignaciones de evaluadores con ronda (las de la ronda 1)
--    Igual que en evaluaciones: se crea el índice nuevo antes de borrar el
--    antiguo, que sostiene las claves foráneas de la tabla.
-- ---------------------------------------------------------------------
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones_evaluadores'
                  AND COLUMN_NAME = 'id_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE asignaciones_evaluadores ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id_asignacion',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql := IF(@existe = 0,
  'UPDATE asignaciones_evaluadores a JOIN cargar_posters p ON p.id = a.id_poster JOIN rondas r ON r.id_evento = p.id_evento AND r.numero = 1 SET a.id_ronda = r.id_ronda',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones_evaluadores'
                  AND INDEX_NAME = 'unq_asig_ronda');
SET @sql := IF(@existe = 0,
  'ALTER TABLE asignaciones_evaluadores ADD UNIQUE KEY unq_asig_ronda (id_poster, id_evaluador, id_ronda)',
  'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @existe := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asignaciones_evaluadores'
                  AND INDEX_NAME = 'unq_poster_evaluador');
SET @sql := IF(@existe > 0, 'ALTER TABLE asignaciones_evaluadores DROP INDEX unq_poster_evaluador', 'DO 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- ---------------------------------------------------------------------
-- 7) Selecciones y premios
--    Una fila = un póster que pasó el corte hacia `id_ronda`. Tras publicar
--    el podio esa fila recibe `lugar` y `premio`.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selecciones (
  id_seleccion INT(11) NOT NULL AUTO_INCREMENT,
  id_ronda INT(11) NOT NULL,
  id_poster INT(11) NOT NULL,
  seleccion_manual TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = lo agregó el admin a mano
  lugar SMALLINT(6) DEFAULT NULL,                   -- NULL en el corte; 1..P en el podio
  premio VARCHAR(60) DEFAULT NULL,                  -- "1er lugar"
  fecha_seleccion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notificado TINYINT(1) NOT NULL DEFAULT 0,        -- 1 = ya se envió el aviso
  PRIMARY KEY (id_seleccion),
  UNIQUE KEY unq_seleccion_ronda_poster (id_ronda, id_poster),
  KEY idx_seleccion_lugar (id_ronda, lugar),
  CONSTRAINT fk_sel_ronda FOREIGN KEY (id_ronda) REFERENCES rondas (id_ronda) ON DELETE CASCADE,
  CONSTRAINT fk_sel_poster FOREIGN KEY (id_poster) REFERENCES cargar_posters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 8) Verificación (el usuario revisa aquí que todo quedó bien)
-- ---------------------------------------------------------------------
SELECT r.id_ronda, r.id_evento, r.numero, r.nombre, r.estado, r.cupos_seleccion, r.premios
FROM rondas r ORDER BY r.id_evento, r.numero;

SELECT id, id_ronda, nombre FROM criterios_evaluacion ORDER BY id;

SELECT id_evaluacion, id_poster, id_ronda, id_evaluador, promedio_total FROM evaluaciones;
SELECT id, id_poster, id_ronda, id_evaluador, id_criterio, calificacion FROM evaluaciones_detalles;
SELECT id_asignacion, id_ronda, id_poster, id_evaluador FROM asignaciones_evaluadores;
SELECT * FROM selecciones;
