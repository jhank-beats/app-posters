-- ============================================================================
-- BD/migracion_fase4_notificaciones.sql
-- Migración idempotente para la Fase 4: registro de cambios de espacio físico
-- de pósters para notificaciones in-app (campana) y trazabilidad de avisos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cambios_espacio_log (
    id_cambio INT AUTO_INCREMENT PRIMARY KEY,
    id_poster INT NOT NULL,
    id_espacio_anterior INT NULL DEFAULT NULL,
    nombre_espacio_anterior VARCHAR(150) NULL DEFAULT NULL,
    numero_anterior INT NULL DEFAULT NULL,
    id_espacio_nuevo INT NULL DEFAULT NULL,
    nombre_espacio_nuevo VARCHAR(150) NULL DEFAULT NULL,
    numero_nuevo INT NULL DEFAULT NULL,
    es_cambio TINYINT(1) NOT NULL DEFAULT 1,
    fecha_cambio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cambio_poster (id_poster, fecha_cambio),
    CONSTRAINT fk_cambio_espacio_poster FOREIGN KEY (id_poster)
        REFERENCES cargar_posters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
