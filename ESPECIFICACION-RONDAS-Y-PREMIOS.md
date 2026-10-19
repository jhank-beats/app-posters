# ESPECIFICACIÓN — Rondas de evaluación y premios
### Documento de desarrollo para un asistente externo (Mimo v2.6 Pro)

> ## ⚠️ LEE ANTES DE ESCRIBIR UNA LÍNEA
>
> 1. **`SEGURIDAD-CAMBIOS.txt`** — informe de las vulnerabilidades que ya se corrigieron
>    (acceso sin sesión, suplantación de rol por URL, **IDOR / escalamiento porque el backend
>    confiaba en datos del cliente**, sesión sin token, URL quemada a localhost) y de cómo se
>    resolvió. **Esta funcionalidad introduce las rutas y los permisos más delicados del
>    sistema (quien corta, quien publica premios, quien ve notas ajenas)**: la lectura de ese
>    informe es **obligatoria** y cada decisión nueva debe respetar lo que ya se estableció.
> 2. **`CONTEXTO-DESARROLLO.md`** — paleta institucional, reglas de CSS, patrones de modal,
>    mapa de archivos y restricciones.
>
> Este documento define **una sola funcionalidad nueva**; todo lo que no esté descrito aquí
> debe quedar como está. Las secciones **8 (Seguridad)** y **9 (Responsive)** no son
> sugerencias: son requisitos de aceptación.

---

## 1. Qué hay que construir

Hoy el sistema tiene **una sola evaluación**: un póster se asigna a N evaluadores, cada uno
lo califica con los criterios de `criterios_evaluacion`, y se saca un promedio. No existe el
concepto de rondas.

El flujo real de la universidad tiene **varias rondas**:

| Ronda | Qué es | Quién evalúa | Para qué sirve |
|---|---|---|---|
| **1** | Exposición en mesa, en el espacio físico asignado | Los evaluadores asignados a ese póster | Elegir los **primeros puestos** que pasan al auditorio |
| **2** | Exposición ante todo el auditorio | **Todos los evaluadores que participaron en la ronda 1** (sin conflicto de intereses) | Elegir a los **ganadores / premios** |
| 3+ | (futuro, no implementar ahora) | — | — |

Por cada ronda se necesita: **configurar** (criterios, cupos, número de premios), **evaluar**,
**cortar por promedio**, **notificar por correo y en la campana**, y en la última ronda
**entregar premios** con badge y certificado.

---

## 2. Decisiones ya tomadas (no questioningar, son requisitos)

1. **Modelo de rondas genérico**: tabla `rondas` con `numero`, para que mañana exista una
   ronda 3 sin migración nueva.
2. **Criterios distintos por ronda**: `criterios_evaluacion.id_ronda`. Los 3 criterios
   actuales (Contenido, Diseño, Exposición) son de la **ronda 1**.
3. **Participantes de la ronda 2**: los evaluadores (rol 2) que **guardaron al menos una
   evaluación en la ronda 1**, excluyendo al **autor de cada póster** (conflicto de interés:
   `cargar_posters.id_usuario`).
4. **Corte por promedio**: el sistema **pre-selecciona** el top N, el admin revisa, quita o
   agrega a mano y **confirma**.
5. **Empates**: cuando hay empate en el promedio (en el corte o en el podio), **decide el
   admin**; el sistema solo lo **detecta y lo avisa**.
6. **Premios**: el admin/super admin indica **cuántos premios hay** (3, 2, más). Se genera un
   **badge** en la interfaz y un **certificado descargable** ("bonito y presentable").
7. **Permisos**: **admin (3) y super admin (4) hacen lo mismo**. Solo el super admin crea
   eventos (regla existente, no cambiar).
8. **Avisos**: **correo + campana** en todos los casos, incluyendo:
   - autores cuyo póster pasó a la siguiente ronda,
   - evaluadores cuando se abre una ronda,
   - ganadores cuando se publica el podio.
9. **Sin dependencias nuevas** en npm y sin cambiar la paleta ni el diseño fuera de lo pedido.
10. **Seguridad**: los endpoints nuevos respetan el esquema de `SEGURIDAD-CAMBIOS.txt`
    (`require_role`, identidad **siempre** tomada del token, cero confianza en el cliente,
    prepared statements, sin filtrar errores internos). No se copia el patrón inseguro de los
    endpoints antiguos.
11. **Responsive**: la funcionalidad debe verse y usarse igual en móvil, tablet y escritorio.
    No se acepta trabajo entregado sin verificar en las tres. Ver §9.

### Defaults tomados (si el documento no dice más, se aplica esto)

- **Participó en la ronda 1** = tiene ≥ 1 fila en `evaluaciones` de esa ronda (no basta estar
  asignado).
- **Nota de una evaluación** = promedio de `evaluaciones_detalles.calificacion` de los
  criterios **de esa ronda** (2 decimales). El campo legacy `evaluaciones.promedio_total` se
  recalcula con ese valor.
- **Promedio de un póster en una ronda** = promedio de las notas de **todas** sus evaluaciones
  en esa ronda (2 decimales). Se calcula en la consulta SQL, no se guarda en otra tabla.
- **Corte** = top N por el promedio de la **ronda 1**. Solo entran pósters con **≥ 1 evaluación**.
- **Podio** = top P por el promedio de la **ronda 2**, donde P = `rondas.premios`.
- **Al confirmar el corte** la ronda 1 queda **cerrada** y sus evaluaciones **bloqueadas**
  para edición (el evaluador ya no ve "✏️ Editar", solo lectura).
- Un póster **sin ninguna evaluación** no se selecciona solo; el admin puede agregarlo a mano.
- **Rehacer una selección** es permitido: se reemplaza, y solo se notifica a los **nuevos**
  seleccionados (los que salen pierden el pase y no se les manda retractación).

---

## 3. Estado actual del código (verificado, no reexplorar)

**Base de datos** (MySQL/MariaDB, base `posters`, credenciales por `getenv` en `backend/Conexion.php`):

```sql
cargar_posters        id, titulo, autores, descripcion, categoria, palabrasClave, ruta_imagen,
                      id_usuario, fecha_registro, activo, id_evento (FK eventos), id_espacio
eventos               id_evento, nombre_evento, codigo_evento (UNIQUE), fecha_inicio, fecha_fin, activo
usuario               id, nombres, apellidos, correo, contraseña (hash), id_rol, activo
roles                 1=usuario 2=evaluador 3=admin 4=super_admin
criterios_evaluacion  id, nombre, descripcion, activo, fecha_creacion
asignaciones_evaluadores  id_asignacion, id_poster, id_evaluador, fecha_asignacion,
                          UNIQUE(id_poster, id_evaluador)
evaluaciones          id_evaluacion, id_poster, id_evaluador, calificacion_contenido,
                      calificacion_diseño, calificacion_exposicion, promedio_total,
                      observaciones, fecha_evaluacion, UNIQUE(id_poster, id_evaluador)
evaluaciones_detalles id, id_poster, id_evaluador, id_criterio, calificacion, observaciones,
                      UNIQUE(id_poster, id_evaluador, id_criterio)
espacios_fisicos      id_espacio, nombre_espacio, ubicacion_detallada
categorias            ...
```

**Puntos que importan**:
- `evaluaciones` y `evaluaciones_detalles` tienen UNIQUE **sin ronda** → hoy una segunda
  evaluación del mismo póster por el mismo evaluador **pisa** la primera. Hay que romper esos
  índices.
- `criterios_evaluacion` es **global**, no depende de nada.
- Las evaluaciones **no están ligadas al evento** (los pósters sí). Al cambiar de evento las
  notas se mezclan: por eso las rondas deben colgar de `id_evento`.
- Las columnas legacy `calificacion_contenido/diseño/exposicion` de `evaluaciones` ya no se
  usan (el flujo real es `evaluaciones_detalles`). **No borrarlas** en esta entrega.
- Hoy hay 4 evaluadores (ids 14, 19, 31, 34) y 2 evaluaciones registradas.

**Backend** (`backend/api/`), estilo de todos los endpoints: `header()` de CORS, preflight
`OPTIONS`, `switch ($_SERVER['REQUEST_METHOD'])`, `include '../Conexion.php'`, respuesta JSON
`{success, data, count}` o `{status, data}`. Autenticación en `backend/api/includes/Auth.php`:
`require_role([3,4])` (el super admin, rol 4, siempre pasa), `require_login()`, `auth_current()`,
`cors_headers()`. Correos en `backend/api/includes/Correos.php`:
`enviarCorreoNotificacion()`, `encolarCorreoFondo()` (proceso PHP aparte, no bloquea),
`responderJsonYNotificar()`.

> ⚠️ `AsignarEvaluadores.php` hoy **no** valida el rol. Todos los endpoints nuevos **sí**
> deben usar `require_role()`. No es tarea de esta entrega arreglar los viejos.

**Frontend** (`src/`):
- `components/roles/generales/MostrarPosters.jsx` — tabla usada por **usuario, evaluador,
  admin y super admin** (props `limite`, `verMas`, `soloMisPosters`, `soloAsignados`, `idEvaluador`).
  El evaluador solo ve lo asignado porque llama `TablaPosters.php?id_evaluador=X`, que hace
  `INNER JOIN asignaciones_evaluadores`.
- `components/roles/generales/MostrarPostersAdmin.jsx` — inventario (14 columnas) con
  acciones por póster.
- `components/roles/generales/ModalEvaluacion.jsx` — modal de calificación del evaluador.
- `components/roles/generales/VistaPreviaPoster.jsx` — vista previa con datos arriba y archivo abajo.
- `components/roles/generales/TarjetaPosterQR.jsx`, `AsignarEvaluadorModal.jsx`,
  `AsignarEspacioModal.jsx`, `EditarPoster.jsx`.
- `components/roles/super_admin/GestionCriterios.jsx`, `GestionEventosModal.jsx`,
  `HomePageSuperAdmin.jsx` (7 secciones), `components/roles/admin/HomePageAdmin.jsx`,
  `components/roles/evaluador/HomePageEvaluador.jsx`, `components/roles/usuario/HomePageUsuario.jsx`.
- `components/roles/generales/NotificacionesBell.jsx` — campana. Polling **60 000 ms**, clave de
  lecturas `notif_leidas_${tipo}_${idUsuario}`, y ya tiene 3 ramas de contenido
  (`super_admin`/`admin`, `usuario`, `evaluador`) más la lista `{id, icon, titulo, desc, ancla}`.
- `components/ProtectedRoute.jsx`, `src/auth.js` (parche global de `fetch` con `Authorization`).
- `components/roles/generales/roles.css` (1565+ líneas), `Formulario.css`, `Evaluar.css`.

---

## 4. Cambios de base de datos

Archivo nuevo: **`BD/migracion_rondas.sql`** (en la carpeta `BD/`, junto a los demás `.sql`).
El usuario lo aplica a mano: **no hay sistema de migraciones**, no inventes uno. Debe ser
**idempotente** (poder ejecutarlo dos veces sin romper) y **conservar los datos actuales**.

```sql
-- 1) Rondas por evento
CREATE TABLE IF NOT EXISTS rondas (
  id_ronda INT(11) NOT NULL AUTO_INCREMENT,
  id_evento INT(11) NOT NULL,
  numero TINYINT(4) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  estado ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
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

-- 2) Criterios por ronda (los 4 criterios actuales pasan a la ronda 1)
ALTER TABLE criterios_evaluacion
  ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id,
  ADD KEY fk_criterio_ronda (id_ronda),
  ADD CONSTRAINT fk_criterio_ronda FOREIGN KEY (id_ronda) REFERENCES rondas (id_ronda) ON DELETE CASCADE;

-- 3) Evaluaciones con ronda (romper el UNIQUE actual)
ALTER TABLE evaluaciones
  DROP INDEX id_poster,
  ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id_poster,
  ADD UNIQUE KEY unq_eval_poster_evaluador_ronda (id_poster, id_evaluador, id_ronda),
  ADD KEY idx_eval_ronda (id_ronda),
  ADD CONSTRAINT fk_eval_ronda FOREIGN KEY (id_ronda) REFERENCES rondas (id_ronda) ON DELETE CASCADE;

ALTER TABLE evaluaciones_detalles
  DROP INDEX evaluacion_unica,
  ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id_poster,
  ADD UNIQUE KEY uniq_detalle (id_poster, id_evaluador, id_ronda, id_criterio),
  ADD KEY idx_detalle_ronda (id_ronda);

-- 4) Asignaciones con ronda
ALTER TABLE asignaciones_evaluadores
  DROP INDEX unq_poster_evaluador,
  ADD COLUMN id_ronda INT(11) NOT NULL DEFAULT 1 AFTER id_asignacion,
  ADD UNIQUE KEY unq_asig_ronda (id_poster, id_evaluador, id_ronda);

-- 5) Selecciones y premios
CREATE TABLE IF NOT EXISTS selecciones (
  id_seleccion INT(11) NOT NULL AUTO_INCREMENT,
  id_ronda INT(11) NOT NULL,
  id_poster INT(11) NOT NULL,
  seleccion_manual TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = lo agregó el admin a mano
  lugar SMALLINT(6) DEFAULT NULL,                   -- NULL en el corte; 1..P en el podio
  premio VARCHAR(60) DEFAULT NULL,                  -- "🥇 1er lugar"
  fecha_seleccion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notificado TINYINT(1) NOT NULL DEFAULT 0,        -- 1 = ya se envió el aviso
  PRIMARY KEY (id_seleccion),
  UNIQUE KEY unq_seleccion_ronda_poster (id_ronda, id_poster),
  KEY idx_seleccion_lugar (id_ronda, lugar),
  CONSTRAINT fk_sel_ronda FOREIGN KEY (id_ronda) REFERENCES rondas (id_ronda) ON DELETE CASCADE,
  CONSTRAINT fk_sel_poster FOREIGN KEY (id_poster) REFERENCES cargar_posters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) Ronda 1 del evento activo, para que el sistema arranque con datos utilizables
INSERT INTO rondas (id_evento, numero, nombre, estado, premios)
SELECT id_evento, 1, 'Ronda 1 · Exposición en mesa', 'abierta', 3 FROM eventos WHERE activo = 1;
```

**Notas obligatorias**
- Los **2 registros de `evaluaciones` actuales** pasan a `id_ronda = 1` (lo hace el `DEFAULT 1`
  de la columna; verificar con `SELECT` y corregir a mano si hiciera falta). Lo mismo con sus
  `evaluaciones_detalles` y las `asignaciones_evaluadores`.
- La ronda 2 **no usa `asignaciones_evaluadores`**: su elegibilidad se calcula por
  participación en la ronda 1 + conflicto de intereses (ver §5.3). La columna `id_ronda` en esa
  tabla existe solo para que las asignaciones de la ronda 1 queden explícitas.
- No borrar `evaluaciones.calificacion_*`.
- Documentar en el `.sql`, con `--` al inicio, qué hace cada bloque.

---

## 5. Backend

### 5.1 Endpoint nuevo `backend/api/Rondas.php`

`GET` (las acciones de detalle requieren login; `participantes`, `resumen_ronda` e `informe_ronda`
exigen `require_role([3,4])` porque exponen correos y notas):

| Parámetro | Devuelve |
|---|---|
| `id_evento` | Todas las rondas del evento con su estado, `corte_confirmado`, cupos, premios y el conteo de evaluaciones |
| `id_ronda` | Detalle de una ronda: ranking de pósters con `promedio` (media entre evaluadores), `n_evaluaciones`, `seleccionado`, `lugar`, `premio`, y si hay **empate en el corte** |
| `action=participantes&id_ronda` | Evaluadores de la ronda con `n_asignados`, `n_calificados` y `n_pendientes` |
| `action=resumen_ronda&id_ronda` | Resumen para el PDF (ronda cerrada): título, categoría, promedio, evaluaciones y `pasa` (seleccionado en la ronda siguiente). En la Ronda 2+ **solo lista los pósters clasificados** para esa ronda |
| `action=informe_ronda&id_ronda` | **Informe detallado**: por póster, la nota individual de cada evaluador (o `null` si está pendiente), sus observaciones y el `promedio` entre todos. En la Ronda 2+ **solo lista los pósters clasificados** para esa ronda (los eliminados en el corte no aparecen) |

`POST` (todos exigen `require_role([3,4])`), cuerpo JSON con `accion`:

| `accion` | Efecto |
|---|---|
| `crear_ronda` | Crea la ronda siguiente del evento (`numero` automático) con `nombre`, `cupos_seleccion`, `premios`. |
| `actualizar_ronda` | Edita nombre, cupos y premios de una ronda **abierta**. |
| `abrir_ronda` / `cerrar_ronda` | `abrir_ronda` cambia el estado a abierto, avisa por correo a los evaluadores participantes (solo la primera vez) y **resetea `corte_confirmado`**. `cerrar_ronda` es **solo** el cierre final (exige `confirmar_cierre_final: true` y que la ronda no tenga siguiente). **No cierra con pósters sin calificar** (ver `forzar_cierre_pendientes`). |
| `previsualizar_corte` | `{id_ronda, cupos}` → devuelve el **top N sugerido** por promedio, marcando los que entran por empate (`empate: true`) para que el admin decida. **No escribe nada.** Devuelve además `pendientes[]` y `pendientes_total` (pósters sin calificar en esa ronda). |
| `forzar_cierre_pendientes` | *(parámetro booleano de `cerrar_y_pasar` y `cerrar_ronda`)* Si hay pósters sin calificar y **no** se envía, la operación se rechaza con `409 tipo=pendientes_sin_calificar` devolviendo `pendientes[]` (con `titulo`, `faltan`, `evaluado_de`, `sin_evaluadores`) y `titulos[]`. Solo se cierra si el admin lo envía `true` de forma explícita. |
| `cerrar_y_pasar` | *(acción única de cierre, Fase 1)* `{id_ronda, cupos, ids_seleccionados[], manuales[], evaluadores_siguiente, nombre_siguiente, cupos_siguiente, premios_siguiente}` → valida selección no vacía, crea la ronda siguiente, guarda las selecciones, **reasigna evaluadores al azar** (sin autor ni quien ya calificó; 1 por póster si la siguiente es la ronda 1, si no `evaluadores_siguiente` con defecto 3), cierra la ronda con `corte_confirmado = 1` y encola los correos. Todo en una transacción con cada `execute()` verificado. Devuelve `evaluadores_por_poster`, `sin_evaluadores[]` (pósters sin candidatos) y `sin_criterios`. |
| `confirmar_corte` | *(deprecado)* Devuelve `410` con el mensaje de usar `cerrar_y_pasar`. |
| `corregir_seleccion` | Quita o agrega pósters de una ronda **cerrada con corte confirmado** (re-selección). Limpia las asignaciones de los pósters que salen y solo notifica a los nuevos. |
| `previsualizar_podio` | `{id_ronda, premios}` → top P por promedio de esa ronda + empates. |
| `publicar_podio` | `{id_ronda, premios, lugares[]}` → asigna `lugar`/`premio`, **cierra la ronda**, notifica a ganadores y evaluadores. |
| `deshacer_podio` | Borra `lugar`/`premio` y reabre la ronda (para corregir errores). |

Reglas transversales:
- Toda escritura valida que la ronda exista y que el rol sea admin/super admin.
- Idempotencia: si se pulsa dos veces, no duplicar selecciones (el `UNIQUE` ayuda) ni correos
  (marcar `notificado = 1` en la misma operación que encola el correo).
- Un evaluador **no puede** guardar evaluaciones de una ronda cerrada:
  `Evaluaciones.php` debe recibir y validar `id_ronda` (ver §5.2).
- Un evaluador **no puede** calificar un póster del que es autor: responder `403` con mensaje
  claro ("No puedes evaluar tu propio póster").
- Respuestas con mensajes en español,`tipo` de error y código HTTP correcto (400/403/404/500).

### 5.2 Cambios en endpoints existentes

- **`Evaluaciones.php`** (`POST`): aceptar `id_ronda`, guardarlo en `evaluaciones` y en
  `evaluaciones_detalles`, calcular `promedio_total` con **los criterios de esa ronda**, y
  validar ronda abierta + no autor + no duplicar.
- **`Evaluaciones.php`** (`GET`): devolver el detalle de criterios de la ronda recibida.
- **`Criterios.php`**: incluir `id_ronda` en el listado y aceptar `id_ronda` al crear/editar.
- **`AsignarEvaluadores.php`**: enviar `id_ronda = 1` en los `INSERT` (las asignaciones son
  de la ronda 1). Sin cambios de comportamiento.
- **`TablaPosters.php`** (`GET`): nuevos parámetros opcionales y columnas nuevas:
  - parámetros: `id_ronda`, `orden` (`fecha` | `promedio_desc` | `promedio_asc`),
    `solo_seleccionados`, `ronda`;
  - columnas por póster y ronda: `id_ronda`, `nombre_ronda`, `promedio_ronda`,
    `n_evaluaciones_ronda`, `seleccionado`, `lugar`, `premio`, `es_autor`;
  - el cálculo del promedio: subconsulta promediando `evaluaciones.promedio_total` de la
    ronda, o `AVG` de los detalles; **contar también los evaluadores pendientes** para poder
    mostrar "3 de 5 Qualification".
  - El filtro por `id_evaluador` (evaluador) debe seguir funcionando **además** de la ronda.
- **`Notificaciones.php`** (nuevo, pequeño) o extender `TablaSolicitudes.php`: devolver las
  novedades de rondas que la campana necesita (póster del usuario que pasó de ronda, ronda
  abierta para evaluadores, podio publicado). Formato: lista `{id, icon, titulo, desc, ancla}`.

### 5.3 Reglas de elegibilidad (implementar en un solo lugar, no duplicar en el front)

> **Actualizado en la Fase 1:** la ronda 2+ **sí** usa `asignaciones_evaluadores`. Al confirmar
> el corte (`cerrar_y_pasar`) se reasignan evaluadores al azar y, por eso, la regla de la ronda 2
> ya no depende de "quién participó en la ronda 1".

- **Evaluadores por póster (regla 2026-10):** la **Ronda 1 tiene UN SOLO evaluador** por póster
  (`limite = 1`; `AsignarEvaluadores.php` rechaza listas mayores con un mensaje claro y el modal
  muestra selección única). Desde la **Ronda 2 en adelante pueden ser varios** (por defecto 3,
  ajustable de 1 a 5 con `evaluadores_siguiente` al cerrar la ronda).
- **Nota que ve el autor:** siempre es el **promedio entre todos los evaluadores** de ese póster
  en esa ronda (`rh_estadisticas_ronda` → `AVG` de las notas individuales). La vista lo indica
  con "promedio de N evaluadores".
- **Informe para admin/super admin:** `action=informe_ronda&id_ronda=` devuelve, por póster, la
  nota individual de cada evaluador (o "pendiente") y el promedio entre todos.
- **Cierre con pósters sin calificar (2026-10):** no se puede cerrar ni cortar una ronda si
  quedan pósters sin calificar. `previsualizar_corte` devuelve `pendientes[]` para que el modal
  muestre el aviso con los títulos **antes** de confirmar; si aún así se intenta, el backend
  responde `409 pendientes_sin_calificar` con la lista y **solo** se cierra si el cliente envía
  `forzar_cierre_pendientes: true` (botón "Cerrar de todos modos"). En la ronda 2+ solo se
  miran los pósters seleccionados para esa ronda.
- **Autor** ⇔ `usuario.id = poster.id_usuario` → nunca puede calificar su propio póster.
- **Asignado en ESA ronda** ⇔ existe fila en `asignaciones_evaluadores` con ese `id_poster`,
  ese `id_evaluador` y ese `id_ronda` (vale para la ronda 1 y para cualquier ronda posterior).
- **Ronda 2+** ⇔ además debe existir fila en `selecciones` con ese póster y esa ronda
  (es decir, el póster pasó el corte de la ronda anterior).
- **Ya calificó ese póster** ⇔ existe `evaluaciones`/`evaluaciones_detalles` con ese póster y
  ese evaluador (en cualquier ronda) → no se vuelve a calificar.
- Reasignación aleatoria de la ronda N+1 (`rh_reasignar_aleatorio_ronda`): por cada póster que
  pasó se sortean evaluadores activos que **no** son el autor y que **no** lo calificaron antes.
  **No suma evaluadores si ya alcanzó el tope** (re-ejecutar el corte es inocuo).

---

## 6. Frontend

### 6.1 `GestionRondas.jsx` (nuevo) — panel de admin/super admin

Modal o sección con tarjetas, una por ronda del evento, en orden:

```
Ronda 1 · Exposición en mesa        [ABIERTA]
  Criterios: Contenido, Diseño, Exposición        (ver / editar)
  Cupos para la siguiente ronda: [ 5 ]   Premios: [ 3 ]
  Evaluados: 12 de 14 pósters · 2 sin nota
  [ Ver ranking ]  [ Cambiar criterios ]  [ Cerrar ronda ]
```

En el **ranking** (tabla): posición, póster (título/autores), promedio de la ronda
(destacado en `#132740`), nº de evaluaciones, estado (`Sin evaluar`, `Parcial`, `Completo`),
seleccionado, lugar y premio. Encima, la barra de **corte**:

- input numérico de cupos (sin tope; validar ≤ pósters con evaluación; si se supera, avisar),
- botón **"Previsualizar corte"** → resalta el top N, marca los empates con
  `badge-rol rol-2` y una nota "hay empate en la posición de corte: decide tú",
- casillas para quitar/agregar a mano (queda `seleccion_manual = 1`),
- **"Confirmar corte"** (pide confirmación con un resumen: cuántos pasan, cuántos autores se
  avisarán) y **"Rehacer selección"** si ya estaba confirmada.

Al confirmar, la tarjeta muestra el **podio** de la ronda siguiente: top P, edición del lugar
de cada uno, botón **"Publicar podio"** y, tras publicarlo, botones **"Certificado"** por
ganador.

### 6.2 Tablas de pósters

**`MostrarPosters.jsx`** y **`MostrarPostersAdmin.jsx`**, ambas:
- barra de filtros con: **ronda** (select), **orden por promedio** (mayor / menor),
  **solo seleccionados**, **solo pendientes de calificar**;
- **orden por defecto por promedio descendente** cuando el filtro de ronda está activo
  (el orden por fecha se conserva en las vistas sin ronda, para no romper lo ya conocido);
- columnas nuevas: **Promedio** (grande, con el nº de evaluaciones debajo, p. ej. `4.35` /
  `3 de 5`), **Estado** (`Sin evaluar` / `Parcial 2 de 3` / `Completado`) y, si aplica,
  **Seleccionado / Lugar**;
- en la vista del evaluador, un selector de **ronda**; en la ronda 2 se listan **todos** los
  seleccionados (los no calificables por conflicto aparecen deshabilitados con el motivo);
- **evaluaciones de ronda cerrada en solo lectura** (el botón "✏️ Editar" desaparece y el
  `ModalEvaluacion` no permite guardar).
- `MostrarPostersAdmin.jsx`: nueva acción por póster **"Ver en ranking de ronda"**.

**ModalEvaluacion.jsx**: mostrar a qué ronda pertenece la evaluación; si está cerrada, modo
solo lectura con un aviso.

### 6.3 Vistas por rol

- **Evaluador** (`HomePageEvaluador.jsx`): pestañas o selector de ronda; contador de
  pendientes ("te faltan 3 pósters por calificar en la ronda 2").
- **Usuario** (`HomePageUsuario.jsx` + `MostrarPosters.jsx` con `soloMisPosters`): columna
  **Estado** por ronda (`En espera`, `Pasó a la ronda 2`, `Finalista`, `Ganador 🥇 1er lugar`)
  y su promedio en cada ronda; badge del evento como ahora.
- **Super admin** (`HomePageSuperAdmin.jsx`): nueva sección **"Rondas y premios"** (la 8ª
  sección, con `seccion-eyebrow` + `contenedor-tabla`), con un resumen por evento: rondas,
  estado, cups, premios y los ganadores.
- **Criterios** (`GestionCriterios.jsx`): agrupar por ronda con un selector de ronda; los
  criterios de la ronda 1 no se pueden borrar si ya hay evaluaciones.

### 6.4 Certificados (nuevo `CertificadoPremio.jsx`)

Generar en el **frontend**, sin dependencias nuevas, con el patrón ya usado en
`ListadoUbicaciones.jsx` (`window.open` + CSS de impresión): página **A4 horizontal** con la
paleta institucional, logo, texto "Certificado", nombre del autor, título del póster,
**lugar obtenido**, nombre y código del evento, y pie con la fecha. Botones
**"Descargar certificado"** (diálogo de impresión → guardar como PDF) y **"Imprimir"**.
Desde la tabla de ganadores se puede abrir **uno por uno** y también **todos juntos**
(repetir un `<section class="certificado">` por página con `break-after: page`).

### 6.5 Correos y campana

Correos nuevos (HTML institucional, asunto claro), todos vía
`Correos.php::encolarCorreoFondo()` en bucle, con `selecciones.notificado = 1` para no
repetir:

| Momento | Destinatarios | Asunto sugerido |
|---|---|---|
| Se confirma el corte | Autores (`usuario.correo`) de los pósters seleccionados | `¡Tu póster pasó a la siguiente ronda!` |
| Se abre una ronda | Evaluadores participantes | `Se abrió la{Ronda N} de evaluación` |
| Se publica el podio | Ganadores | `¡Felicidades, obtuviste el {lugar} lugar!` |
| Se publica el podio | Evaluadores | `Resultados de la{Ronda N}` |

La **campana** (`NotificacionesBell.jsx`) suma, en las ramas que ya existen:
- usuario: "Tu póster pasó a la ronda 2", "Obtuviste el 1er lugar";
- evaluador: "Se abrió la ronda 2", "Tienes N pósters por calificar";
- admin/super admin: "Corte confirmado", "Podio publicado".
Mantener el polling de 60 s, la clave `notif_leidas_${tipo}_${idUsuario}` y el formato
`{id, icon, titulo, desc, ancla}`.

---

## 7. Reglas visuales (de `CONTEXTO-DESARROLLO.md`)

- Paleta: `#132740` (texto/encabezados), `#00acc9` (acento/CTA), `#80ba27` (exitoso),
  `#cad400` (premio/.destacado), `#5f5e5e` (texto secundario), `#f5f7f8` (fondos suaves),
  `#ffffff`.
- Tarjetas: `border-top 4px #00acc9`, `border-radius 20px`, `box-shadow 0 6px 20px rgba(19,39,64,.08)`.
- Tablas: `thead` `#132740`, contenedor `contenedor-tabla` (ya responsive con scroll horizontal).
- Modales: overlay `rgba(19,39,64,.78)` + `backdrop-filter blur(4px)`, tarjeta blanca,
  `formularios-header` con `formularios-eyebrow`, botón `cerrar-formulario` arriba a la derecha,
  `cuerpo` con scroll interno.
- Reutiliza las clases que ya existen (`boton-primario`, `campo-formulario`, `filtros`,
  `input-filtro`, `badge-rol`, `badge-evento`, `seccion-eyebrow`, `formularios`) antes de crear
  clases nuevas, y **no edites la sección 6 del doc de contexto** (regla de CSS global).
- Responsive obligatorio: revisar **≤ 640 px** (columnas de la rejilla a 1, filtros en columna,
  sin scroll horizontal en la página) y **991–1300 px** (compressiones de header ya existentes).
- Emojis solo como apoyo visual (los usa todo el sistema); el badge del premio debe incluir
  texto ("1er lugar"), no solo el emoji.

---

## 8. Seguridad (requisito de aceptación)

Este apartado **hereda** lo ya corregido en `SEGURIDAD-CAMBIOS.txt`. Antes de escribir código,
relee ese informe y confirma que cada punto se cumple.

### 8.1 La identidad SIEMPRE viene del token

```php
include_once __DIR__ . '/includes/Auth.php';
cors_headers("GET, POST, OPTIONS");

// Escrituras: solo admin/super admin
$auth = require_role([3, 4]);        // $auth['id'] y $auth['rol'] verificados por HMAC
```

**Prohibido** en todo el código nuevo:
- aceptar `rol_usuario`, `id_usuario`, `id_evaluador` o `admin_id` desde el body/query para
  decidir permisos o para saber "quién soy" (fue la causa de las vulnerabilidades 2 y 3);
- decidir permisos solo ocultando botones en el front;
- guardar en `evaluaciones` un `id_evaluador` que venga del cliente: usar siempre `$auth['id']`.

### 8.2 IDOR: cada quien solo toca lo suyo

Validar **en el servidor**, no solo en la interfaz:

| Acción | Quién puede | Regla a validar en cada petición |
|---|---|---|
| Guardar evaluación | evaluador (2) | Estar asignado al póster **en esa ronda**, o que la ronda sea la ronda 2 y el póster esté seleccionado y sea elegible (participó en la ronda 1 y **no es el autor**) |
| Cambiar notas ya guardadas | evaluador (2) | Que la fila sea **suya** (`id_evaluador = $auth['id']`) y la ronda esté abierta |
| Ver notas de un póster | evaluador (2) | Solo las de las rondas en las que participa |
| Crear/cerrar rondas, cupos, premios | 3 y 4 | `require_role([3, 4])` |
| Previsualizar/publicar corte o podio | 3 y 4 | `require_role([3, 4])` + ronda del evento correcto |
| Ver su cuenta/ranking | cualquiera con sesión | Solo su propio `id` |
| Notificaciones de la campana | cualquiera con sesión | Filtrar por `$auth['id']`; nunca devolver notas ni correos de terceros |

Casos que **deben** probarse a mano (§11): evaluador que intenta calificar un póster no
asignado, autor que intenta calificar su propio póster, usuario normal que llama a
`Rondas.php` con `confirmar_corte`, evaluador que intenta editar notas de ronda cerrada.

### 8.3 Estado de la ronda: nada de carreras

- Al guardar una evaluación, **re-leer** `estado` de la ronda dentro de la misma transacción
  (no confiar en el `estado` que se le mostró al front): si está `cerrada`, `409/403`.
- Al confirmar corte o publicar podio, usar `begin_transaction()` / `commit()` / `rollback()`:
  o se guardan selecciones + ronda siguiente + estado, o no se guarda nada.
- `SELECT ... FOR UPDATE` en la fila de la ronda al confirmar, para que dos admins a la vez no
  generen dos rondas 2.

### 8.4 Datos, SQL y correo

- **`prepare()` + `bind_param()`** en toda consulta. Los enteros que sí se concatenan
  (`id_ronda`, `cupos`) deben pasar antes por `intval()` y validarse en rango.
- **No** copiar el patrón de otros endpoints que hacen `echo $conexion->error` al cliente:
  el mensaje técnico va al log del servidor; al cliente, un mensaje en español y genérico.
- **Escapar contenido de usuario** antes de meterlo en el HTML de los correos
  (`htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8')`): el título y los autores son texto libre
  y se envían por correo.
- En los correos, **solo al `usuario.correo` del póster**: nunca a los autores del texto libre
  ni a correos deduceidos, para no filtrar datos de terceros.
- El `.sql` de la migración **no** lleva contraseñas ni usuarios de base de datos.
- Sin claves de API ni secretos en el código; las credenciales siguen por `getenv`
  (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `AUTH_SECRET`), como ya documenta el informe.
- Mantener el rate limit anti fuerza bruta (`auth_rate_limit()`) en login; usarlo también en
  las escrituras caras (guardar evaluación, confirmar corte, publicar podio) para que nadie pueda
  automatizar el envío masivo de correos ni manipular el ranking.

### 8.5 Cliente: lo que llega del navegador no se ejecuta

- El certificado se genera en una ventana nueva con `document.write` (**patrón ya usado en
  `ListadoUbicaciones.jsx`**): al interpolar título, autores o nombres de evento hay que
  **escapar** el texto. Nada de `innerHTML` con datos del usuario sin escapar.
- No evaluar decisiones de permisos en el front y asumir que el back las repite: el back las
  repite, y el front solo esconde botones.
- No imprimir tokens, correos ni notas en `console.log` de producción.

### 8.6 Verificación obligatoria de seguridad

```bash
php -l backend/api/Rondas.php

# 401/403 esperados (deben fallar, no devolver datos):
curl -s "http://localhost:8000/api/Rondas.php?action=participantes&id_ronda=2"                 # sin token
curl -s -X POST "http://localhost:8000/api/Rondas.php" -H "Content-Type: application/json" \
     -d '{"accion":"confirmar_corte","id_ronda":1,"cupos":5}'                                # sin token
curl -s -X POST "http://localhost:8000/api/Rondas.php" -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token de un Evaluador>" \
     -d '{"accion":"confirmar_corte","id_ronda":1,"cupos":5}'                                # 403
```

Los tres deben responder `401`/`403` con mensaje en español. Si alguno devuelve datos o
`200`, es un fallo de aceptación.

---

## 9. Responsive (requisito de aceptación)

La funcionalidad se usa en el salón con el teléfono en la mano igual que en el escritorio:
**el filtro por promedio y la acción de calificar son justamente lo que más se usa en móvil.**

### 9.1 Puntos de control

| Ancho | Qué debe funcionar |
|---|---|
| **390 px** (móvil) | Filtros en columna, tarjetas de ronda apiladas, botones de acción de 40 px o más, tabla con scroll horizontal **sin** romper el layout, modales con scroll interno |
| **768 px** (tablet) | Rejillas de datos en 2 columnas, filtros en 2 filas |
| **1440 px** (escritorio) | Rejillas en 3–4 columnas, todo centrado, sin desperdiciar ancho |
| **991–1300 px** y **1301–1450 px** | Mantener las compresiones de header ya existentes de `roles.css` |

### 9.2 Reglas técnicas

- Usar las utilidades responsive ya del proyecto (`≤640`, `≤990`, flex + `gap`, `grid`) antes de
  inventar media queries nuevas; si hacen falta, agruparlas junto a las existentes.
- **Nunca** provocar scroll horizontal de la página: comprobar
  `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- Todo `iframe` (visor de PDF) e `img` (miniatura, certificado) con altura **acotada en `vh`**
  o `aspect-ratio`, para que no empujen la pantalla en móvil.
- Textos largos (títulos, palabras clave) con `overflow-wrap: anywhere`; nada de `white-space:
  nowrap` en celdas de datos.
- Botones táctiles ≥ 40 px de alto y separación ≥ 8 px; la información crítica (promedio,
  seleccionado, lugar) **no** puede quedar solo en un `hover`.
- Modales: overlay `rgba(19,39,64,.78)`, tarjeta `max-height: calc(100vh - 2rem)` y
  `overflow-y: auto` en el cuerpo (igual que `VistaPreviaPoster`).
- Las tablas anchas se desplazan dentro de `.contenedor-tabla` (ya lo hace), nunca con
  `width: max-content` sobre toda la página.

### 9.3 Cómo se verifica

Con Chromium headless + CDP, el método de la sección 8 de `CONTEXTO-DESARROLLO.md`
(`Emulation.setDeviceMetricsOverride` + `Runtime.evaluate` + `Page.captureScreenshot`).
Para cada ancho hay que registrar: ancho de la tarjeta/sección, nº de columnas de la rejilla,
`scrollWidth` vs `clientWidth` de la página, y una captura. **Entregar esas capturas junto al
informe de lo implementado.**

## 10. Reglas de código (del proyecto)

- **Backend**: PHP plano con `switch ($_SERVER['REQUEST_METHOD'])`, `header()` de CORS +
  preflight `OPTIONS`, `include '../Conexion.php'`, **siempre `prepare()` + `bind_param()`**
  y concatenar solo enteros ya validados, `cors_headers()` y `require_role()` en los endpoints
  nuevos. Respuestas JSON en español.
- **No** instalar dependencias npm nuevas. **No** tocar `ProtectedRoute`, `src/auth.js` ni el
  parche de `fetch`.
- **No** reescribir los componentes que ya funcionan: `VistaPreviaPoster`, `TarjetaPosterQR`,
  `AsignarEvaluadorModal`, `AsignarEspacioModal`, `Cuenta`, `Formulario.css`.
- Estilo de código acorde al existente: componentes funcionales, `useState`/`useEffect`,
  `const SERVER_URL = \`http://${window.location.hostname}:8000\``, Tailwind **no**.

### Comandos de verificación (obligatorios antes de entregar)

```bash
npm run build      # debe terminar en "✓ built"
npm run lint       # 0 errores (los warnings preexistentes de useEffect se pueden dejar)
php -l backend/api/Rondas.php
php -l backend/api/TablaPosters.php
php -l backend/api/Evaluaciones.php

# Además, y sin excepción:
#   - los 3 casos de §8.6 (401/403) verificados con curl
#   - las capturas responsive de §9.3 en 390 / 768 / 1440 px
```

**Al terminar la entrega** hay que responder, además del código:

1. Qué endpoints se crearon o modificaron, con su método y los roles exigidos.
2. Resultado de los 3 casos de seguridad de §8.6 (respuesta exacta obtenida).
3. Capturas y medidas responsive de los tres anchos.
4. Qué quedó fuera y por qué.

---

## 11. Datos de prueba (para verificar a mano)

| Dato | Valor |
|---|---|
| Super admin | `camilo@gmail.com` (id 7) |
| Admin | buscar en `usuario` con `id_rol = 3` |
| Evaluadores | `juan@gmail.com` (14), `alex@gmail.com` (19), `alexq@gmail.com` (31), `oscar.valderramar@campusucc.edu.co` (34) |
| Usuario | `jhanktech@gmail.com` (id 30) — póster 61 (imagen, evento Semestre B 2026, espacio Piso 2) |
| Contraseña de todos | `usuario123` |
| Eventos | 1 `Semestre B 2026` / `2026-B` (activo), 2 `Semestre A 2027` / `2027-A` (inactivo) |
| Pósters con PDF | 20, 38, 39, 40, 41 |

**Escenario de prueba completo**: activar ronda 1 → calificar como 2 evaluadores → previsualizar
corte con cupos 5 → deseleccionar 1 y agregar 1 a mano → confirmar → verificar correo en
`/tmp/correo_debug.txt` y aviso en la campana del autor → calificar en ronda 2 como evaluador
(no el autor) → publicar podio de 3 → verificar certificados y avisos.

---

## 12. Fuera de alcance (no lo hagas)

- Rondas 3 o posteriores (el modelo ya las soporta, la interfaz no).
- Reasignar o mover pósters de evento.
- Historial/auditoría de cambios de notas (no hay tabla de auditoría en el sistema).
- Panel de resultados públicos en la homepage (solo dentro del panel del super admin).
- Cambiar la paleta, las fuentes o la estructura del header.
- Migrar a otro framework o agregar librerías (jsPDF, html2canvas, Tailwind, etc.).
- **Arreglar los endpoints antiguos que no validan el token** (`AsignarEvaluadores.php`,
  `TablaPosters.php`, `Criterios.php`, `Espacios.php`, `Categorias.php`, `Eventos.php`).
  Es una deuda que ya menciona `SEGURIDAD-CAMBIOS.txt` ("exigir token en escrituras"), pero
  **queda fuera de esta entrega**. Lo obligatorio es que **todo el código nuevo** nazca con
  `require_role()`/`require_login()` y no copie ese patrón.
- **No se acepta la entrega si**: se relajan los permisos, se exponen notas de otros usuarios,
  queda un endpoint nuevo sin validación de rol, o se entrega sin las verificaciones de §8.6
  y §9.3.

---

## 13. Orden de implementación sugerido

1. `BD/migracion_rondas.sql` + endpoint `Rondas.php` de **lectura** (rondas y ranking).
2. `GestionRondas.jsx` básico: crear ronda, editar cupos y premios, ver ranking.
3. `TablaPosters.php` con `id_ronda`, promedios y filtros; aplicar filtros/columnas en las dos
   tablas.
4. `GestionCriterios.jsx` por ronda + `id_ronda` en `Criterios.php` y `Evaluaciones.php`.
5. Corte: previsualizar → editar a mano → confirmar (transacción, correos, campana).
6. Ronda 2: elegibilidad, tabla del evaluador, `ModalEvaluacion` con ronda y bloqueo.
7. Podio: previsualizar, publicar, badges, `CertificadoPremio.jsx`, avisos a ganadores.
8. Vistas de usuario y super admin, `CONTEXTO-DESARROLLO.md` actualizado y verificación final.
