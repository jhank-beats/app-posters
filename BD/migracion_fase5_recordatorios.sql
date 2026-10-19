-- Migración Fase 5: Recordatorios programados dinámicos y editables por Admin / Super Admin
-- Compatible con MySQL 8+ y MariaDB 10.4+. Idempotente.

CREATE TABLE IF NOT EXISTS `recordatorios_config` (
  `id_config` INT(11) NOT NULL AUTO_INCREMENT,
  `hora` VARCHAR(5) NOT NULL COMMENT 'Formato HH:MM (24h)',
  `accion` VARCHAR(40) NOT NULL DEFAULT 'recordatorio' COMMENT 'recordatorio | asignar | reasignar | informe',
  `asunto` VARCHAR(180) NOT NULL DEFAULT 'Recordatorio de evaluación de pósters',
  `mensaje_personalizado` TEXT NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_config`),
  KEY `idx_hora_activo` (`hora`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `recordatorios_log` (
  `id_log` INT(11) NOT NULL AUTO_INCREMENT,
  `id_config` INT(11) DEFAULT NULL,
  `fecha` DATE NOT NULL,
  `hora_programada` VARCHAR(5) DEFAULT NULL,
  `accion` VARCHAR(40) NOT NULL,
  `id_ronda` INT(11) DEFAULT NULL,
  `enviados` INT(11) NOT NULL DEFAULT 0,
  `detalle` TEXT DEFAULT NULL,
  `ejecutado_por` VARCHAR(100) DEFAULT NULL,
  `ejecutado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_log`),
  KEY `idx_fecha_accion` (`fecha`, `accion`, `id_config`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `recordatorios_notificaciones` (
  `id_notif` INT(11) NOT NULL AUTO_INCREMENT,
  `id_evaluador` INT(11) NOT NULL,
  `id_ronda` INT(11) DEFAULT NULL,
  `hora_recordatorio` VARCHAR(5) DEFAULT NULL,
  `asunto` VARCHAR(180) NOT NULL,
  `mensaje_personalizado` TEXT NOT NULL,
  `cantidad_pendientes` INT(11) NOT NULL DEFAULT 0,
  `resumen_posters` TEXT NOT NULL,
  `fecha_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notif`),
  KEY `idx_eval_fecha` (`id_evaluador`, `fecha_envio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Semilla inicial por defecto (solo si la tabla está vacía)
INSERT INTO `recordatorios_config` (`hora`, `accion`, `asunto`, `mensaje_personalizado`, `activo`)
SELECT '08:30', 'recordatorio', 'Primer recordatorio de calificación de pósters',
       'Te recordamos revisar y calificar los pósters que tienes asignados en la jornada actual.', 1
WHERE NOT EXISTS (SELECT 1 FROM `recordatorios_config`);

INSERT INTO `recordatorios_config` (`hora`, `accion`, `asunto`, `mensaje_personalizado`, `activo`)
SELECT '09:00', 'recordatorio', 'Segundo recordatorio de calificación de pósters',
       'Por favor completa la evaluación de tus pósters pendientes antes del cierre de la ronda.', 1
WHERE (SELECT COUNT(*) FROM `recordatorios_config`) = 1;

INSERT INTO `recordatorios_config` (`hora`, `accion`, `asunto`, `mensaje_personalizado`, `activo`)
SELECT '09:30', 'recordatorio', 'Último recordatorio antes de reasignación',
       'Último aviso de calificación. Acércate a los espacios indicados para registrar tus evaluaciones pendientes.', 1
WHERE (SELECT COUNT(*) FROM `recordatorios_config`) = 2;
