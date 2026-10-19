-- =============================================================================
-- MIGRACIÓN FASE 6: Eventos simultáneos (Sistemas / Civil) + Admin por Evento
-- =============================================================================
-- Arquitectura definida por dirección académica:
-- 1. Un único Super Admin (id_rol = 4) que ve y gestiona TODOS los eventos.
-- 2. Eventos simultáneos e independientes (ej. Ingeniería de Sistemas e Ingeniería Civil).
-- 3. Administradores por evento (id_rol = 3) con columna `id_evento` en `usuario`
--    para que cada Admin gestione y filtre únicamente su evento asignado.
-- 4. Tabla puente `poster_eventos` (id_poster, id_evento) + backfill desde cargar_posters.
-- =============================================================================

SET NAMES utf8mb4;

-- 1. Limpiar rol 5 si existía de versiones previas y asegurar que usuarios rol 5 pasen a rol 3 (admin)
UPDATE `usuario` SET `id_rol` = 3 WHERE `id_rol` = 5;
DELETE FROM `roles` WHERE `id_rol` = 5;

-- 2. Agregar columna `carrera` a `eventos` si no existe
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'eventos'
    AND COLUMN_NAME = 'carrera'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE `eventos` ADD COLUMN `carrera` ENUM(''sistemas'',''civil'',''ambas'') NOT NULL DEFAULT ''sistemas'' AFTER `codigo_evento`',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_add_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Índice compuesto (carrera, activo) en `eventos`
SET @idx_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'eventos'
    AND INDEX_NAME = 'idx_eventos_carrera_activo'
);
SET @sql_add_idx = IF(
  @idx_exists = 0,
  'ALTER TABLE `eventos` ADD INDEX `idx_eventos_carrera_activo` (`carrera`, `activo`)',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_add_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- 3. Agregar columna `id_evento` a `usuario` (para asignar un Admin a un evento específico)
SET @col_usr_ev = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuario'
    AND COLUMN_NAME = 'id_evento'
);
SET @sql_add_usr_ev = IF(
  @col_usr_ev = 0,
  'ALTER TABLE `usuario` ADD COLUMN `id_evento` INT(11) DEFAULT NULL AFTER `id_rol`, ADD INDEX `idx_usuario_evento` (`id_evento`)',
  'SELECT 1'
);
PREPARE stmt_usr_ev FROM @sql_add_usr_ev;
EXECUTE stmt_usr_ev;
DEALLOCATE PREPARE stmt_usr_ev;

-- 4. Tabla puente `poster_eventos` para que un póster pueda participar en uno o varios eventos
CREATE TABLE IF NOT EXISTS `poster_eventos` (
  `id_poster` int(11) NOT NULL,
  `id_evento` int(11) NOT NULL,
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_poster`, `id_evento`),
  KEY `idx_poster_eventos_evento` (`id_evento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Backfill de pósters existentes hacia `poster_eventos`
INSERT IGNORE INTO `poster_eventos` (`id_poster`, `id_evento`)
SELECT `id`, `id_evento`
FROM `cargar_posters`
WHERE `id_evento` IS NOT NULL AND `id_evento` > 0;

-- 5. Evento inicial activo para Ingeniería Civil (simultáneo con el de Ingeniería de Sistemas)
INSERT INTO `eventos` (`nombre_evento`, `codigo_evento`, `carrera`, `fecha_inicio`, `fecha_fin`, `activo`)
SELECT 'Semestre B 2026 - Ingeniería Civil', '2026-B-CIV', 'civil', '2026-08-01', '2026-12-10', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `eventos` WHERE `carrera` = 'civil'
);

-- Crear Ronda 1 para el evento de Ingeniería Civil si no tiene rondas aún
INSERT INTO `rondas` (`id_evento`, `numero`, `nombre`, `estado`, `fecha_inicio`, `cupos_seleccion`, `premios`, `corte_confirmado`)
SELECT e.`id_evento`, 1, 'Ronda 1 · Evaluación inicial (Ing. Civil)', 'abierta', NOW(), 5, 3, 0
FROM `eventos` e
WHERE e.`codigo_evento` = '2026-B-CIV'
  AND NOT EXISTS (
    SELECT 1 FROM `rondas` r WHERE r.`id_evento` = e.`id_evento`
  );

-- 6. Crear/actualizar Admin de Ingeniería de Sistemas y Admin de Ingeniería Civil (id_rol = 3)
-- Admin de Sistemas: valentina.torres@campusucc.edu.co -> id_evento del evento activo de Sistemas
UPDATE `usuario` u
JOIN `eventos` e ON e.`carrera` = 'sistemas' AND e.`activo` = 1
SET u.`id_evento` = e.`id_evento`
WHERE u.`id_rol` = 3 AND (u.`correo` = 'valentina.torres@campusucc.edu.co' OR u.`id_evento` IS NULL);

-- Admin de Civil: civil.admin@campusucc.edu.co (contraseña: usuario123, id_rol = 3)
INSERT INTO `usuario` (`nombres`, `apellidos`, `correo`, `contraseña`, `carrera`, `id_rol`, `activo`, `desactivado`)
SELECT 'Carlos', 'Mendoza', 'civil.admin@campusucc.edu.co', '$2y$12$hljN0aU2J37F9iGYB37X0OfjAfytZuwbaXps9OIKfN8b3/WPHQ0gW', 'Ingeniería Civil', 3, 1, 0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `usuario` WHERE `correo` = 'civil.admin@campusucc.edu.co'
);

UPDATE `usuario` u
JOIN `eventos` e ON e.`carrera` = 'civil' AND e.`activo` = 1
SET u.`id_rol` = 3,
    u.`id_evento` = e.`id_evento`
WHERE u.`correo` = 'civil.admin@campusucc.edu.co';

-- 7. Crear espacios físicos iniciales para el evento de Ingeniería Civil si no tiene ninguno
INSERT INTO `espacios_fisicos` (`id_evento`, `nombre_espacio`, `ubicacion_detallada`, `capacidad`)
SELECT e.`id_evento`, 'Plazoleta Bloque Civil - Piso 1', 'Espacio principal de exposición Ingeniería Civil', 15
FROM `eventos` e
WHERE e.`codigo_evento` = '2026-B-CIV'
  AND NOT EXISTS (
    SELECT 1 FROM `espacios_fisicos` ef WHERE ef.`id_evento` = e.`id_evento`
  );

-- 8. Normalizar las carreras de los usuarios a las 2 carreras participantes y asignar su id_evento automáticamente
UPDATE `usuario`
SET `carrera` = CASE
    WHEN LOWER(`carrera`) LIKE '%civil%' THEN 'Ingeniería Civil'
    ELSE 'Ingeniería de Sistemas'
END;

UPDATE `usuario` u
JOIN `eventos` e ON e.`carrera` = 'civil' AND e.`activo` = 1
SET u.`id_evento` = e.`id_evento`
WHERE u.`id_rol` IN (1, 2, 3)
  AND LOWER(u.`carrera`) LIKE '%civil%'
  AND (u.`id_evento` IS NULL OR u.`id_rol` IN (1, 2));

UPDATE `usuario` u
JOIN `eventos` e ON e.`carrera` = 'sistemas' AND e.`activo` = 1
SET u.`id_evento` = e.`id_evento`
WHERE u.`id_rol` IN (1, 2, 3)
  AND LOWER(u.`carrera`) NOT LIKE '%civil%'
  AND (u.`id_evento` IS NULL OR u.`id_rol` IN (1, 2));
