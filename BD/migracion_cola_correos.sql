-- Cola de correos (H6/M4): en lugar de un proceso exec por correo,
-- se inserta aquí y un cron la drena.
-- Ejecutar una sola vez.

CREATE TABLE IF NOT EXISTS cola_correos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  destinatario VARCHAR(255) NOT NULL,
  asunto VARCHAR(255) NOT NULL,
  mensaje MEDIUMTEXT NOT NULL,
  estado ENUM('pendiente','enviado','error') NOT NULL DEFAULT 'pendiente',
  intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ultimo_error VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cola_estado (estado, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
