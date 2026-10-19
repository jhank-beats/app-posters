-- =====================================================================
-- BD/reset_demo.sql — RESET COMPLETO de la base `posters` a estado DEMO
-- =====================================================================
-- QUÉ HACE:
--   * Borra todos los datos de negocio (usuarios, posters, evaluaciones,
--     rondas, criterios, eventos, espacios, categorías) y los vuelve a
--     crear limpios y consistentes.
--   * Deja EXACTAMENTE 5 usuarios: 1 super_admin, 1 admin, 1 evaluador
--     y 2 usuarios.
--   * TODOS los usuarios usan la contraseña: demo1234
--     (hash bcrypt idéntico en los 5, generado con PASSWORD_BCRYPT)
--
-- CÓMO USARLO:
--   mysql -u root -p posters < BD/reset_demo.sql
--
-- IMPORTANTE — POSTERS:
--   Este script deja la tabla cargar_posters VACÍA a propósito.
--   Después ejecuta BD/demo_upload.sh para subir los 4 pósters de demo
--   por la API REAL (SubirPosters.php), igual que lo haría una persona
--   desde el formulario de la app.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1) LIMPIEZA TOTAL (orden irrelevante con FK checks off)
-- ---------------------------------------------------------------------
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

DELETE FROM poster_profesores;
DELETE FROM evaluaciones_detalles;
DELETE FROM evaluaciones;
DELETE FROM asignaciones_evaluadores;
DELETE FROM selecciones;
DELETE FROM cargar_posters;
DELETE FROM criterios_evaluacion;
DELETE FROM rondas;
DELETE FROM espacios_fisicos;
DELETE FROM eventos;
DELETE FROM categorias;
DELETE FROM usuario;
DELETE FROM roles;

-- Resetear contadores para IDs limpios y predecibles
ALTER TABLE poster_profesores AUTO_INCREMENT = 1;
ALTER TABLE usuario AUTO_INCREMENT = 1;
ALTER TABLE cargar_posters AUTO_INCREMENT = 1;
ALTER TABLE roles AUTO_INCREMENT = 1;
ALTER TABLE eventos AUTO_INCREMENT = 1;
ALTER TABLE rondas AUTO_INCREMENT = 1;
ALTER TABLE criterios_evaluacion AUTO_INCREMENT = 1;
ALTER TABLE espacios_fisicos AUTO_INCREMENT = 1;
ALTER TABLE categorias AUTO_INCREMENT = 1;

-- ---------------------------------------------------------------------
-- 2) ROLES (los 4 del sistema)
-- ---------------------------------------------------------------------
INSERT INTO roles (id_rol, nombre_rol, descripcion, nivel_acceso) VALUES
  (1, 'usuario',      'Usuario general con permisos básicos (solo visualiza y participa)', 1),
  (2, 'evaluador',    'Usuario que puede revisar y evaluar posters', 2),
  (3, 'admin',        'Administrador del sistema con acceso a gestión de usuarios y evaluaciones', 3),
  (4, 'super_admin',  'Administrador principal con acceso total al sistema', 4);

-- ---------------------------------------------------------------------
-- 3) USUARIOS — 5 en total, todos con contraseña "demo1234"
--    IDs: 1=super_admin, 2=admin, 3=evaluador, 4 y 5=usuarios
-- ---------------------------------------------------------------------
SET @hash = '$2y$12$hljN0aU2J37F9iGYB37X0OfjAfytZuwbaXps9OIKfN8b3/WPHQ0gW';

INSERT INTO usuario (id, nombres, apellidos, correo, `contraseña`, carrera, id_rol, activo, desactivado) VALUES
  (1, 'Camilo Andrés',  'Moncaleano Murillo', 'camilo.murillo@campusucc.edu.co',  @hash, 'Ingeniería de Sistemas', 4, 1, 0),
  (2, 'Valentina',      'Torres Gómez',       'valentina.torres@campusucc.edu.co', @hash, 'Ingeniería de Sistemas', 3, 1, 0),
  (3, 'Diego Alejandro','Fernández Cruz',     'diego.fernandez@campusucc.edu.co',  @hash, 'Ingeniería de Sistemas', 2, 1, 0),
  (4, 'Sofía',          'Herrera López',      'sofia.herrera@campusucc.edu.co',    @hash, 'Ingeniería Civil',       1, 1, 0),
  (5, 'Mateo',          'Ríos Acosta',        'mateo.rios@campusucc.edu.co',       @hash, 'Ingeniería de Sistemas', 1, 1, 0);
ALTER TABLE usuario AUTO_INCREMENT = 6;

-- ---------------------------------------------------------------------
-- 4) EVENTOS — 1 activo (el que se usa en la demo) + 1 futuro inactivo
-- ---------------------------------------------------------------------
INSERT INTO eventos (id_evento, nombre_evento, codigo_evento, fecha_inicio, fecha_fin, activo) VALUES
  (1, 'Semestre B 2026', '2026-B', '2026-10-01', '2026-12-15', 1),
  (2, 'Semestre A 2027', '2027-A', '2027-02-01', '2027-05-30', 0);

-- ---------------------------------------------------------------------
-- 5) RONDA 1 del evento activo (abierta, lista para evaluar)
-- ---------------------------------------------------------------------
INSERT INTO rondas (id_ronda, id_evento, numero, nombre, estado, fecha_inicio, fecha_cierre, cupos_seleccion, premios, creado_por) VALUES
  (1, 1, 1, 'Ronda 1 · Exposición en mesa', 'abierta', '2026-10-01 08:00:00', '2026-11-30 23:59:00', NULL, 3, 1);
ALTER TABLE rondas AUTO_INCREMENT = 2;

-- ---------------------------------------------------------------------
-- 6) CRITERIOS de la ronda 1 (Contenido / Diseño / Exposición)
-- ---------------------------------------------------------------------
INSERT INTO criterios_evaluacion (id, id_ronda, nombre, descripcion, activo) VALUES
  (1, 1, 'Contenido',   'Calidad y solidez del contenido académico del póster', 1),
  (2, 1, 'Diseño',      'Presentación visual, organización y estética del póster', 1),
  (3, 1, 'Exposición',  'Oratoria, manejo de tiempos y respuesta a preguntas', 1);
ALTER TABLE criterios_evaluacion AUTO_INCREMENT = 4;

-- ---------------------------------------------------------------------
-- 7) ESPACIOS FÍSICOS del evento activo (la subida autoasigna uno libre)
-- ---------------------------------------------------------------------
INSERT INTO espacios_fisicos (id_espacio, nombre_espacio, ubicacion_detallada, capacidad, id_evento) VALUES
  (1, 'Piso 1', 'Bloque A · Salón 101', 10, 1),
  (2, 'Piso 2', 'Bloque B · Salón 203', 8,  1);
ALTER TABLE espacios_fisicos AUTO_INCREMENT = 3;

-- ---------------------------------------------------------------------
-- 8) CATEGORÍAS — alineadas con las opciones del formulario de la app
--    (CargarPosters.jsx usa estos valores exactos)
-- ---------------------------------------------------------------------
INSERT INTO categorias (id_categorias, nombre_categorias, activo) VALUES
  (1, 'desarrolloWeb', 1),
  (2, 'programacion',  1),
  (3, 'backend',       1),
  (4, 'frontend',      1),
  (5, 'calculo',       1),
  (6, 'estadistica',   1);
ALTER TABLE categorias AUTO_INCREMENT = 7;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 9) VERIFICACIÓN (debe devolver: 5 usuarios, 0 posters, 1 ronda abierta)
-- ---------------------------------------------------------------------
SELECT u.id, u.nombres, u.apellidos, u.correo, r.nombre_rol AS rol
FROM usuario u JOIN roles r ON r.id_rol = u.id_rol
ORDER BY u.id;

SELECT COUNT(*) AS posters_en_bd  FROM cargar_posters;
SELECT COUNT(*) AS usuarios_total FROM usuario;
SELECT id_ronda, id_evento, numero, nombre, estado FROM rondas;
SELECT id, id_ronda, nombre FROM criterios_evaluacion;
