# PLAN DE MEJORAS DEL APLICATIVO DE PÓSTERS
### Documento de trabajo — procesos y cambios a implementar

- **Origen:** reunión con el jefe de sistemas, jefe de programa de Ingeniería Civil y profesores de sistemas.
- **Fuente de requisitos:** archivo `mejoras aplicativo` (raíz del proyecto) — 8 recomendaciones.
- **Base de análisis:** código real de `src/` (React + Vite), `backend/api/` (PHP) y esquema `BD/`.
- **Fecha:** octubre 2026.

---

## 1. Diagnóstico: las 8 recomendaciones vs. el estado actual

| # | Recomendación | Estado | Hueco principal |
|---|---|---|---|
| 1 | Asignar evaluadores **aleatorios al subir** un póster | ❌ No existe | Hoy la asignación es 100 % manual desde `AsignarEvaluadorModal.jsx`. No hay ningún `rand()`/`ORDER BY RAND()` en el backend. |
| 2 | Campo para **asignar profesores** al subir (póster de dos materias) | ❌ No existe | No hay tabla de profesores/materias ni campo en el formulario; `autores` es solo texto libre. |
| 3 | **Detección de duplicados** (título y descripción parecidos) | ⚠️ Parcial | Solo igualdad exacta en minúsculas. El front no procesa la respuesta `status:"duplicados"` ni envía `forzar_guardado` (parámetro huérfano). |
| 4 | **Eventos independientes Sistemas y Civil**, 2 super admins, home general | ⚠️ Parcial | Solo 1 evento activo global (activar Civil apagaría Sistemas); sin campo carrera; imposible crear un 2º super admin desde la UI; home hardcodeado a "Comunidad GensTI / Ingeniería de Sistemas". |
| 5 | Correo de asignación con **espacio + número**; aviso de **cambio de espacio** | ⚠️ Parcial | El correo trae el título pero no el espacio. El cambio de espacio solo notifica al autor, nunca a los evaluadores, y no distingue "cambio" de "primera asignación". |
| 6 | Arreglar **cerrar rondas** + claridad de ronda 2 + **PDF resumen** | 🔴 Bug confirmado | Dos botones con semánticas distintas, desfase de rondas en el listado vs. guardado, sin PDF. Causa raíz detallada en §3. |
| 7 | **Recordatorios 8:30 / 9:00 / 9:30** + reasignación + informe | ❌ 0 % | No existe cron, job, scheduler ni script CLI en `backend/`. |
| 8 | Vista del **evaluador que también publica** + no autoevaluarse | ⚠️ Parcial | La no autoevaluación existe solo *al calificar*; la asignación permite elegir al autor (pendiente imposible). El home del evaluador no permite publicar pósters. |

---

## 2. Decisiones confirmadas

| Decisión | Elegido |
|---|---|
| Orden de fases | Rondas primero (bug bloqueante), luego formulario, vista evaluador, notificaciones, recordatorios y eventos. |
| Cierre de rondas | **Un solo flujo** "Cerrar y pasar a la siguiente" (se elimina la duplicitad de botones). |
| Evaluadores ronda 2 | **Reasignación aleatoria excluyendo a quien ya calificó ese póster** (se cambia la regla actual "solo evalúan en R2 los que participaron en R1"). |
| Póster en ambas carreras | **Un póster con 2 eventos vinculados**: al subir se elige Sistemas, Civil o **Ambas**. |
| Dos super admins | **Nuevo rol `5 = super_admin_civil`** en la tabla `roles`. |
| Recordatorios | **Crontab en el servidor** (hay acceso) + botón manual de respaldo. |
| Generación de PDF | **`window.print()` con plantilla A4** (mismo patrón que `CertificadoPremio.jsx`). *jsPDF está prohibido por la especificación del proyecto (`INFORME-RONDAS-Y-PREMIOS.md:97`, `ESPECIFICACION-RONDAS-Y-PREMIOS.md:617`).* |

---

## 3. Causa raíz del bug de rondas (recomendación 6)

Síntoma reportado: *"cerré la ronda, ya estaba la segunda, al calificar un póster asignado me dice que no fue escogido para esa ronda"*.

1. **Dos botones con semánticas opuestas.**
   - `cerrar_ronda` (`Rondas.php:484-501`) solo hace `UPDATE estado='cerrada'`. **No** escribe selecciones, **no** crea la ronda siguiente, **no** envía correos. Es el botón más visible ("Cerrar ronda", `GestionRondas.jsx:488-490`).
   - `confirmar_corte` (`Rondas.php:541-708`) crea la ronda N+1, escribe `selecciones`, envía correos y cierra. Está escondido en "Ver ranking → Previsualizar corte → Confirmar corte".
   - Si el admin cerró con el primero, la ronda 2 queda **sin selecciones** y *todos* los pósters responden "no fue seleccionado".
2. **Desfase de rondas en la vista del evaluador** (`MostrarPosters.jsx`): en la pestaña "Todas" (por defecto) el listado sale de `asignaciones_evaluadores` (ronda 1) pero el guardado usa la ronda 2 auto-detectada → `Evaluaciones.php:319-323` devuelve 403. **Éste es el error exacto que viste.**
3. `confirmar_corte` **acepta lista vacía** (`normalizarIdsPosters`, `Rondas.php:529-539`): puede cerrar una ronda pasando 0 pósters sin ningún error.
4. **Sin distinción** entre "cerrada con corte" y "cerrada sin corte" (`rondas.estado` solo tiene `abierta|cerrada`).
5. `TablaPosters.php:265-267` solo calcula `calificable` si llega `id_ronda`; sin ella, todo sale como "⭐ Calificar" y el bloqueo aparece **después** de puntuar.
6. El endpoint `Rondas.php?action=participantes` (evaluadores elegibles) **existe pero ningún consumidor del front lo usa**.
7. `AsignarEvaluadores.php:108` borra **todas** las asignaciones del póster sin filtrar `id_ronda` (destruye el histórico).
8. No hay ninguna librería ni botón de PDF en todo el proyecto.

---

# FASE 1 — RONDAS *(arreglar el bug reportado)*

> **Objetivo:** cerrar una ronda sea un solo paso claro, la ronda 2 funcione con evaluadores nuevos, visibilidad del estado para todos los roles y PDF resumen.
> **Archivos:** `Rondas.php`, `RondasHelper.php`, `Evaluaciones.php`, `TablaPosters.php`, `GestionRondas.jsx`, `MostrarPosters.jsx`, `HomePageEvaluador.jsx`, `rondasResumen.js`, `BD/`.

### 1.1 Base de datos
- [ ] **Migración idempotente** (estilo `BD/migracion_rondas.sql`): añadir a `rondas` la columna `corte_confirmado TINYINT(1) NOT NULL DEFAULT 0`.
- [ ] (Opcional) Índice para acelerar `asignaciones_evaluadores` por `(id_ronda, id_poster)`.

### 1.2 Backend — `Rondas.php`
- [ ] **Acción única `cerrar_y_pasar`** que reemplace la duplicitad actual:
  1. Validar que la ronda esté `abierta`.
  2. Validar que la selección de pósters **no esté vacía** (rechazar con 400 si es 0).
  3. Crear la ronda N+1 si no existe (copiar criterios, como ya hace `confirmar_corte`).
  4. `DELETE` + `INSERT` en `selecciones` **verificando cada `affected_rows`** (hoy se commitea aunque fallen los INSERT, `Rondas.php:634-647`).
  5. Disparar la **reasignación aleatoria** de la ronda siguiente (ver 1.3).
  6. Cerrar la ronda actual y marcar `corte_confirmado = 1`.
  7. Enviar correos (autor: "pasó de ronda"; nuevos evaluadores: "te asignaron pósters de la Ronda 2").
- [ ] Mantener `cerrar_ronda` **solo** para el caso final "cerrar sin pasar nada" (última ronda), con confirmación explícita y **sin** crear ronda siguiente.
- [ ] Exigir ronda `abierta` también en `confirmar_corte`/`corregir_seleccion` (hoy no lo exigen).

### 1.3 Backend — reasignación aleatoria para ronda 2 (`RondasHelper.php`)
- [ ] Nueva función `rh_reasignar_aleatorio_ronda(id_ronda_siguiente)`:
  - Por cada póster seleccionado que pasó de la ronda anterior:
    - Candidatos = usuarios con rol 2 (evaluador) **que NO calificaron ese póster en la ronda 1** (consultar `evaluaciones`) y **que no son el autor** (`cargar_posters.id_usuario`).
    - Sorteo aleatorio (`ORDER BY RAND()`), N evaluadores por póster (mismo número que en la ronda 1).
    - Insertar en `asignaciones_evaluadores` con `id_ronda = id_ronda_siguiente`.
- [ ] **Cambiar la regla de elegibilidad** `rh_elegibilidad` / `rh_elegibilidad_lote` (`RondasHelper.php:157-286`):
  - Ronda ≥ 2: además de exigir fila en `selecciones`, exigir fila en `asignaciones_evaluadores` de **esa** ronda (ya no solo "participó en la ronda anterior").
  - Eliminar/relajar `rh_participo_en_ronda` ("solo evalúan en R2 los que participaron en R1") porque contradice el nuevo requisito.
  - Mantener el bloqueo de no autoevaluación.
- [ ] Actualizar los mensajes de bloqueo para que sean claros para el evaluador ("Este póster no te fue asignado en esta ronda", "Ya calificaste este póster en una ronda anterior").

### 1.4 Backend — `TablaPosters.php` y `Evaluaciones.php`
- [ ] `TablaPosters.php:265-267`: calcular `calificable`/`motivo_bloqueo` **siempre** (no solo cuando llega `id_ronda`), resolviendo la ronda vigente del servidor si el cliente no la manda.
- [ ] `Evaluaciones.php:306-308`: eliminar el fallback silencioso a "ronda 1" cuando no llega `id_ronda` (exigirlo explícitamente).
- [ ] Endpoint de **resumen de ronda** limpio para el PDF: título del póster, promedio, evaluaciones, si pasó (ya está calculado en `getDetalleRnda`/ranking; solo exponerlo).

### 1.5 Frontend — `GestionRondas.jsx`
- [ ] **Reemplazar** los botones "Cerrar ronda" y "Confirmar corte" por **un solo botón "Cerrar ronda y pasar a la siguiente"** que abre un modal con:
  - Previsualización del corte (ranking con casillas, como ya existe).
  - Aviso rojo si se va a pasar **0** pósters (bloquear la confirmación).
  - Resumen final antes de confirmar: "Se cerrará la Ronda N, X pósters pasan a la Ronda N+1 y se reasignarán evaluadores al azar".
- [ ] Badge de estado en cada tarjeta de ronda: **"Corte confirmado"** vs. **"Cerrada sin corte"** (usando `corte_confirmado`).
- [ ] **Botón "PDF resumen"** al lado de cada ronda cerrada.
- [ ] Mostrar, por ronda, quiénes son los evaluadores asignados y cuántos pósters faltan por calificar (consumir `Rondas.php?action=participantes`).

### 1.6 Frontend — PDF del resumen (`GestionRondas.jsx` o componente nuevo `ResumenRondaPDF.jsx`)
- [ ] Generar con `window.open('','_blank') + document.write + window.print()` (mismo patrón que `CertificadoPremio.jsx:104-135` y `ListadoUbicaciones.jsx:85-95`). **No usar jsPDF** (prohibido por la especificación).
- [ ] Contenido: encabezado con evento y nombre de la ronda, fecha de cierre, tabla con **título del póster, categoría, nota promedio y cantidad de evaluaciones**, y una columna/pie que indique cuáles **pasaron a la siguiente ronda**.

### 1.7 Frontend — `MostrarPosters.jsx` (fix crítico del bug)
- [ ] **Unificar la ronda entre el listado y el guardado:** enviar `id_ronda` **siempre** en el listado (hoy solo se envía con selección explícita, líneas 206-209), para que la lista y el `idRonda` del `ModalEvaluacion` sean la misma ronda.
- [ ] En la pestaña "Todas", mostrar el conjunto correcto (pósters de la ronda vigente) en vez de mezclar asignaciones de R1 con guardado en R2.
- [ ] Mostrar el badge 🚫 con `motivo_bloqueo` **antes** de que el evaluador intente calificar (hoy solo aparece el botón y el error llega después).
- [ ] Desacoplar la "vista del autor" (estado por ronda) de la "vista del evaluador" para que no se pisen.

### 1.8 Frontend — `HomePageEvaluador.jsx` y `rondasResumen.js`
- [ ] Pestañas de ronda más informativas: estado (abierta/cerrada), si el corte ya se confirmó, total de pósters de la ronda y cuántos lleva el evaluador.
- [ ] `rondasResumen.js`: reducir/invalider la caché de 15 s al cerrar/abrir una ronda (hoy el evaluador puede ver rondas viejas).

### ✔ Verificación de la Fase 1
Reproducir el escenario del jefe: subir 2 pósters → asignar evaluadores → calificar los 2 → **Cerrar ronda y pasar** → verificar que se crea la Ronda 2 con evaluadores **distintos** (o al menos distintos a quienes calificaron cada póster) → el evaluador de la R2 ve sus pósters y **puede calificar sin el error** → el admin descarga el PDF con título y promedio de los que pasaron.

---

# FASE 2 — FORMULARIO DE SUBIR PÓSTER

> **Objetivo:** campo de profesores, detección de duplicados real y asignación aleatoria automática al subir.
> **Archivos:** `CargarPosters.jsx`, `EditarPoster.jsx`, `SubirPosters.php`, `TablaPosters.php`, `AsignarEvaluadores.php`, `Categorias.php`, `BD/`.

### 2.1 Base de datos
- [x] Nueva tabla puente **`poster_profesores`**: `id_poster FK`, `id_usuario FK (profesor)`, `materia VARCHAR`, `fecha_registro`, con `UNIQUE(id_poster, id_usuario, materia)`.
- [x] Añadir a `cargar_posters`: columna **`hash_archivo CHAR(64)`** (SHA-256 del PDF/imagen) para detectar archivos idénticos.
- [x] Verificar/crear la columna **`id_evento`** en `cargar_posters` (hoy el INSERT no la rellena).

### 2.2 Backend — `SubirPosters.php`
- [x] **Guardar `id_evento`** en el INSERT (línea 133-135): hoy calcula el evento activo (108-113) pero no lo persiste → el póster queda huérfano de evento y rompe los filtros posteriores.
- [x] Recibir y persistir **`profesores[]`** y **`materias[]`** en `poster_profesores`.
- [x] Calcular y guardar **`hash_archivo`** del archivo subido.
- [x] **Asignación aleatoria de evaluadores al subir** (recomendación 1): tras el insertar el póster, sortear N evaluadores excluyendo al autor (y priorizando `usuario.carrera` coincidente con la categoría/carrera del póster), escribir en `asignaciones_evaluadores` y enviar el correo de asignación.
- [x] **Detección de duplicados difusos** (reemplazar `SubirPosters.php:42-90`):
  - Normalizar títulos y descripciones (minúsculas, sin acentos, sin puntuación).
  - Comparar con `similar_text` / `levenshtein` con umbral (p. ej. ≥ 85 % título, ≥ 90 % descripción) — hoy solo hay igualdad exacta.
  - Comparar también `hash_archivo` (mismo PDF subido dos veces = duplicado exacto).
  - Comparar `autores` y `palabrasClave` como señal secundaria.
  - Evitar falsos positivos con descripciones muy cortas (el `str_contains` actual bloquea cualquier descripción que contenga a otra).
  - Acotar la comparación al **evento** correcto.
  - Responder `{"status":"duplicados","duplicados":[{titulo,autor,porcentaje,motivo}]}` y aceptar `forzar_guardado=true` para subir igual.
  - Usar *prepared statements* y transacción (hoy hay *race condition* entre el chequeo y el INSERT).
- [x] Añadir **validación de sesión/rol** (`Auth.php`): hoy cualquiera puede subir pósters con un POST simple.

### 2.3 Backend — `CargarPosters`/profesores (nuevo endpoint o en `TablaUsuarios.php`)
- [x] Endpoint que devuelva la lista de **profesores** (usuarios con carrera, posiblemente rol 1 o 2) para el campo de selección múltiple del formulario.

### 2.4 Backend — `TablaPosters.php`
- [x] `traerPosters()`: hacer `JOIN` de `poster_profesores` para mostrar los profesores/materias en los listados (admin, evaluador y autor).
- [x] `modificarPoster()`: aplicar el **mismo chequeo de duplicados** al editar (hoy hace `UPDATE` directo sin validar) y permitir editar los profesores/materias.

### 2.5 Frontend — `CargarPosters.jsx` y `EditarPoster.jsx`
- [x] Campo **"Profesores asignados"** (selección múltiple desde el endpoint de profesores).
- [x] Campo **"Materias"** (permite el caso "un póster para dos materias"): múltiple o lista de pares profesor–materia.
- [x] **Manejar la respuesta `duplicados`** (hoy `CargarPosters.jsx:56-69` solo distingue `success` y todo lo demás es un `alert`): mostrar los candidatos con su % de similitud y ofrecer **"Subir de todos modos"** (enviar `forzar_guardado=true`, parámetro que hoy está muerto) o cancelar y corregir.
- [x] Validación de longitud de `descripcion` (BD es `varchar(255` y trunca en silencio).
- [x] **Cargar las categorías desde `Categorias.php`** en vez del `<select>` hardcodeado de 6 opciones (que además no coincide con los valores reales de la BD).

### ✔ Verificación de la Fase 2
Subir un póster con dos profesores y dos materias → verificar que quedan en `poster_profesores` y se ven en los listados → subir un título casi idéntico a uno existente → aparece la pantalla de duplicados con el % y permite forzar → el evaluador asignado recibe el correo automáticamente sin intervención del admin.

---

# FASE 3 — VISTA DEL PROFESOR QUE TAMBIÉN EVALÚA

> **Objetivo:** recomendación 8. Reforzar la no-autoevaluación.
> **Archivos:** `HomePageEvaluador.jsx`, `HeaderEvaluador.jsx`, `AsignarEvaluadorModal.jsx`, `AsignarEvaluadores.php`, `CargarPosters.jsx`.

- [x] En `HomePageEvaluador.jsx`: añadir sección **"Mis pósters publicados"** + botón **"Publicar póster"** que abra el modal `CargarPosters` (reutilizar el patrón de `HomePageUsuario.jsx:99-103`).
- [x] Listar los pósters publicados por el propio evaluador con su estado (en evaluación, pasó de ronda, etc.).
- [x] **Bloquear la autoevaluación en la asignación** (hoy solo se bloquea *al calificar*, lo que crea "pendientes imposibles"):
  - `AsignarEvaluadorModal.jsx`: ocultar/deshabilitar al autor del póster en la lista de evaluadores.
  - `AsignarEvaluadores.php::obtenerEvaluadoresYAsignaciones()`: excluir al autor con `u.id <> (SELECT id_usuario FROM cargar_posters WHERE id = ?)`.
  - `AsignarEvaluadores.php::guardarAsignacion()`: **validar en servidor** que ningún `evaluadores_ids` sea el autor (hoy acepta cualquier lista).
- [x] Texto de ayuda en la vista del evaluador explicando qué puede hacer (evaluar los asignados + publicar los suyos).

### ✔ Verificación de la Fase 3
Un usuario con la vista de evaluador publica un póster → aparece en "Mis pósters publicados" → al asignarle evaluadores a ese póster, **él no aparece en la lista** → un POST forzado que lo incluya es rechazado por el backend.

---

# FASE 4 — NOTIFICACIONES (CORREOS Y CAMPAÑA)

> **Objetivo:** recomendación 5.
> **Archivos:** `AsignarEvaluadores.php`, `Espacios.php`, `Notificaciones.php`, `NotificacionesBell.jsx`, `Correos.php`, `RondasHelper.php`.

- [x] **Correo de asignación con espacio:** añadir al cuerpo (`AsignarEvaluadores.php:161-165`) el `nombre_espacio` y el **número dentro del espacio** (la fórmula del ordinal ya está calculada en `TablaPosters.php:95-98`).
  - Mensaje alternativo si `id_espacio IS NULL`: "sin ubicar todavía".
- [x] **Aviso de cambio de espacio:**
  - `Espacios.php` PUT: **leer el espacio anterior** (hoy no lo lee, por eso no distingue cambio de primera asignación).
  - Si cambió: correo **a los evaluadores asignados** del póster (hoy solo se notifica al autor) + evento in-app.
  - Notificación al autor con el formato "Tu póster cambió del espacio A al espacio B".
- [x] **Notificación in-app:** añadir tipo `cambio-espacio` en `Notificaciones.php` y su tarjeta en `NotificacionesBell.jsx` (para evaluador y autor).
- [x] **No reenviar correos duplicados:** `AsignarEvaluadores.php` borra y reinserta todo y notifica a todos en cada guardado → calcular el *diff* (altas/bajas) y solo notificar a los **nuevos**.
- [x] Unificar los correos con la plantilla con marca `rh_plantilla_correo` (hoy unos usan plantilla y otros van "pelados").
- [x] (Recomendado) Mover las credenciales SMTP de `Correos.php:26-27` a variables de entorno.

### ✔ Verificación de la Fase 4
Asignar un evaluador → el correo incluye título **+ espacio + número** → cambiar el espacio del póster desde `AsignarEspacioModal` → el evaluador recibe correo y campana de "cambio de espacio" → volver a guardar la misma asignación sin cambios → **no** llegan correos repetidos.

---

# FASE 5 — RECORDATORIOS PROGRAMADOS Y CONFIGURABLES (ADMIN Y SUPER ADMIN)

> **Objetivo:** recomendación 7 (con horarios dinámicos, mensajes personalizables y verificación previa de pendientes). **Depende** de la asignación aleatoria de la Fase 2.
> **Archivos:** `backend/api/Recordatorios.php`, `backend/api/includes/RecordatoriosHelper.php`, `backend/tareas/Recordatorios.php`, `BD/migracion_fase5_recordatorios.sql`, `GestionRecordatorios.jsx`, `HomePageAdmin.jsx`, `HomePageSuperAdmin.jsx`.

- [x] **Horarios y mensajes configurables por Admin y Super Admin** (`recordatorios_config`, `Recordatorios.php`, `GestionRecordatorios.jsx`):
  - Agregar, modificar, pausar/activar o eliminar las horas de recordatorio desde una sección dedicada en `HomePageAdmin.jsx` y `HomePageSuperAdmin.jsx`.
  - Personalizar el asunto y el mensaje del recordatorio manteniendo siempre el bloque obligatorio: **número de pósters que faltan por calificar + títulos + espacio físico con su número (`#N`)**.
  - Verificar primero si faltan pósters por calificar; si no faltan, no enviar ningún recordatorio.
- [x] **Script CLI** `backend/tareas/Recordatorios.php` ejecutable con `php Recordatorios.php <accion>`:
  - **`cron`** (por defecto) → evalúa y dispara automáticamente los horarios activos configurados en `recordatorios_config`.
  - **`asignar`** → pósters sin ningún evaluador → asignación aleatoria (reutilizar la función de la Fase 2, excluyendo autores y respetando carrera).
  - **`recordatorio`** → correo y notificación en campana a los evaluadores con pendientes en rondas abiertas (incluyendo cantidad pendiente, títulos y `Espacio #N`).
  - **`reasignar`** → pósters sin calificar en una ronda → reasignarlos aleatoriamente a evaluadores que **ya terminaron** sus pósters asignados (excluyendo autores y quien ya calificó ese póster).
  - **`informe`** → generar el informe del estado (pósters totales, calificados, pendientes, evaluadores con y sin trabajo).
- [x] **Tabla `recordatorios_log`** (`fecha`, `accion`, `id_config`, `ejecutado_por`) para que cada acción programada no se dispare dos veces el mismo día.
- [x] **Sección y botones de ejecución inmediata** en los paneles de Admin y Super Admin (`GestionRecordatorios.jsx`).
- [x] **Crontab** (compatible con horarios dinámicos cada minuto o llamadas puntuales):
  ```
  * * * * *   php /ruta/backend/tareas/Recordatorios.php cron
  ```

### ✔ Verificación de la Fase 5
Ejecutar el script manualmente con la lógica de un día de prueba → los pósters sin evaluadores quedan asignados al azar → los evaluadores con pendientes reciben recordatorio → a las 9:30 los pósters sin calificar se reasignan a evaluadores libres → el informe se genera y el log evita duplicados.

---

# FASE 6 — EVENTOS SISTEMAS/CIVIL + 2 SUPER ADMINS + HOME GENERAL

> **Objetivo:** recomendación 4. La fase más grande; se trocea en 6A, 6B y 6C.
> **Archivos:** `Eventos.php`, `Auth.php`, `TablaUsuarios.php`, `ProtectedRoute.jsx`, `App.jsx`, `Login.jsx`, `Usuarios.jsx`, `GestionEventosModal.jsx`, `HomePageSuperAdmin.jsx`, `GestionRondas.jsx`, `Espacios.php`, `SubirPosters.php`, `HomePage.jsx`, `Header.jsx`, `Footer.jsx`, `PreguntasFrecuentes.jsx`, `index.html`, `BD/`.

### 6A — Un solo Super Admin (rol 4) + Administradores por Evento (rol 3)
- [x] BD: Un único **Super Admin** (`id_rol = 4`) que ve y administra todos los eventos (Sistemas, Civil, etc.).
- [x] BD: Columna `id_evento INT(11) DEFAULT NULL` en `usuario` para vincular cada **Administrador** (`id_rol = 3`) al evento que administra:
  - Admin de Sistemas (`valentina.torres@campusucc.edu.co`, `id_rol = 3`, `id_evento = 1`).
  - Admin de Civil (`civil.admin@campusucc.edu.co`, `id_rol = 3`, `id_evento = 3`).
- [x] `includes/Auth.php`: helper `auth_id_evento_admin($conexion, $auth)` que devuelve `null` para Super Admin (`rol = 4`, ve todo) y el `id_evento` asignado para Admin (`rol = 3`).
- [x] `Usuarios.jsx` y `EditarUsuario.jsx`: selector para que el Super Admin asigne o cambie a qué evento pertenece cualquier Administrador (`id_rol = 3`).
- [x] `TablaPosters.php`, `Espacios.php`, `Rondas.php`, `Recordatorios.php` y `Notificaciones.php`: filtrado automático por `id_evento` cuando quien consulta es un Admin (`id_rol = 3`), y vista global con filtro por evento para el Super Admin (`id_rol = 4`).

### 6B — Eventos simultáneos por carrera (Sistemas / Civil)
- [x] BD: `ALTER TABLE eventos ADD COLUMN carrera ENUM('sistemas','civil','ambas') NOT NULL DEFAULT 'sistemas'` + índice `(carrera, activo)`.
- [x] BD: tabla puente **`poster_eventos (id_poster, id_evento)`** para que un mismo póster participe en **ambos** eventos (decisión: "un póster con 2 eventos vinculados"). Al subir se elige Sistemas / Civil / **Ambas**.
- [x] `Eventos.php`:
  - INSERT/UPDATE con `carrera` (`:61-69`, `:118-127`).
  - **`activación` con `WHERE carrera = ?`** (`:100-115`) — *clave: hoy activar Civil apagaría Sistemas*.
  - Evento activo por carrera, sin `LIMIT 1` global (`:26`).
  - **Migrar la validación `rol_usuario === 'superadmin'` (del body, `:56` y `:94`) a `require_role([4])`** con `Auth.php`.
- [x] Consumidores del evento activo → resolver por el evento del administrador o la **carrera del usuario**:
  - `Espacios.php:26-32` y `:68-73`.
  - `SubirPosters.php:108-113` (+ persistir el `id_evento`, ver Fase 2).
  - `Notificaciones.php:158`, `TablaPosters.php:137-142`.
- [x] Front: `GestionEventosModal.jsx` → select de carrera en formulario, columna en tabla y filtro; `HomePageSuperAdmin.jsx` → columna por carrera y evento; `MostrarPostersAdmin.jsx` → filtro por evento para Super Admin y filtrado automático para Admin de evento.
- [x] **Normalizar `usuario.carrera`**.

### 6C — Home público general
- [x] Generalizar los textos hardcodeados de "Comunidad GensTI / Ingeniería de Sistemas" → **"Ingeniería de Sistemas e Ingeniería Civil"**:
  - `HomePage.jsx:77, :80, :107, :121, :122, :130` (hero, sección comunidad, `alt` de la imagen).
  - `Header.jsx:47` (etiqueta del menú).
  - `Footer.jsx:22, :24, :33, :44, :81`.
  - `PreguntasFrecuentes.jsx:5, :7` (+ revisar el resto).
  - `index.html:9` título, `lang="en"` → `lang="es"` y añadir `<meta name="description">`.
  - Imágenes del carrusel (`HomePage.jsx:26-33`), hoy de "estudiantes de software".
- [x] (Opcional) Mostrar el evento vigente con sus fechas: consumir `GET Eventos.php?activo=1` (hoy el home no hace ningún fetch).

### 6D — Seguridad transversal *(fuera del alcance original, pero detectada y recomendada)*
- [x] `Registro.php:21-22`: **SQL injection real** → migrar a *prepared statements*.
- [x] Añadir `Auth.php` (`require_role`) a: `SubirPosters.php`, `Espacios.php`, `Categorias.php`, `Criterios.php`, `TablaPosters.php` (GET/PUT/DELETE), `AsignarEvaluadores.php` — hoy cualquiera puede subir/editar pósters o crear eventos con un POST simple.
- [x] Migrar credenciales SMTP a variables de entorno.

### ✔ Verificación de la Fase 6
Crear los eventos "Semestre B 2026" (Sistemas) y "Semestre B 2026 - Ingeniería Civil" y activar ambos simultáneamente → subir un póster eligiendo "Ambas" → verificar que aparece en las dos rondas con evaluadores independientes → entrar como Admin de Sistemas o Admin de Civil y comprobar que cada uno ve únicamente los pósters, rondas y espacios de su evento, mientras que el Super Admin ve todo y puede filtrar por evento.

---

## 4. Dependencias entre fases

```
Fase 1 (Rondas) ──────────────────────────────────────► base estable para 4, 5 y 6
Fase 2 (Formulario) ──┬──► Fase 3 (vista evaluador, usa campo de profesores)
                      └──► Fase 5 (recordatorios, reutiliza la asignación aleatoria)
Fase 4 (Notificaciones) ──► se apoya en el correo de asignación de la Fase 2
Fase 6 (Eventos/Civil) ──► cambia la base de eventos que usan las Fases 1 y 2
```

**Orden recomendado de ejecución:** 1 → 2 → 3 → 4 → 5 → 6
*(la Fase 1 desbloquea a los evaluadores hoy mismo; la Fase 6 se puede adelantar si el jefe de programa la pide por fechas del evento).*

---

## 5. Deuda técnica detectada que conviene ir saneando

| Problema | Archivo | Impacto |
|---|---|---|
| SQL injection | `Registro.php:21-22` | Cualquiera puede inyectar al registrarse |
| Sin autenticación | `SubirPosters.php`, `Espacios.php`, `Categorias.php`, `Criterios.php`, `TablaPosters.php`, `AsignarEvaluadores.php` | Cualquiera puede modificar datos con un POST |
| Control de rol por string del cliente | `Eventos.php:56, :94` | Falsificable |
| SMTP en claro | `Correos.php:26-27` | Credenciales expuestas en el repo |
| `DELETE` sin filtro de ronda | `AsignarEvaluadores.php:108` | Destruye el histórico de asignaciones |
| Código muerto | `EvaluarPosterModal.jsx`, `EvaluacionPosters.jsx` | No se importan; usan el payload legacy |
| Caché de 15 s sin invalidación | `rondasResumen.js:2-9` | Estado desactualizado |
| Dumps `BD/` desactualizados | `BD/*.sql` | Faltan columnas y tablas reales |

---

## 6. Checklist de aceptación global

- [x] Un evaluador puede calificar en la ronda 2 sin el error "no fue seleccionado".
- [x] Al cerrar una ronda se pasa a la siguiente en **un solo paso**, con validación de que al menos un póster pase.
- [x] Cada ronda cerrada tiene su **PDF con título y promedio** de los pósters.
- [x] En la ronda 2 evaluan **otros** evaluadores (distintos a quien ya calificó cada póster).
- [x] Al subir un póster se eligen **profesores** (y materias) y se asignan evaluadores **aleatoriamente**.
- [x] Un título o descripción **parecida** genera aviso de duplicados con % de similitud y opción de forzar.
- [x] El correo de asignación incluye **espacio y número**; un cambio de espacio **notifica a los evaluadores**.
- [x] Un profesor con vista de evaluador **puede publicar** su propio póster y **no** puede evaluarlo.
- [x] Los recordatorios de las 8:30 / 9:00 / 9:30 se ejecutan por cron y **generan informe**.
- [x] Sistemas y Civil son eventos **independientes y simultáneos**, con **1 Super Admin global + Admins por evento** y home público general a las dos carreras.
