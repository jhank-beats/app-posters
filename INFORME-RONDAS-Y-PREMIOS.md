# INFORME — Rondas de evaluación y premios

Entrega de la funcionalidad descrita en `ESPECIFICACION-RONDAS-Y-PREMIOS.md`.
Capturas y medidas en `verificacion-responsive/`.

---

## 1. Endpoints creados o modificados

### Nuevos

| Endpoint | Método | Roles exigidos | Qué hace |
|---|---|---|---|
| `backend/api/Rondas.php` | `GET` | `require_login` para rondas/detalle/resumen · **`require_role([3, 4])`** para `action=participantes`, `action=resumen_ronda` y `action=informe_ronda` (devuelven correos y notas) | `id_evento` → rondas del evento con estado, `corte_confirmado`, cupos, premios, criterios, ganadores y conteos · `id_ronda` → detalle + ranking con `promedio` (media entre evaluadores), `n_evaluaciones`, `seleccionado`, `lugar`, `premio`, `empate_corte`, `empate_podio` · `action=participantes&id_ronda` → evaluadores con `n_asignados`, `n_calificados`, `n_pendientes` · `action=resumen_ronda&id_ronda` → resumen para el PDF (título, categoría, promedio, evaluaciones y **`pasa`** = seleccionado en la ronda siguiente; solo rondas cerradas y, en Ronda 2+, solo los pósters clasificados en ella) · `action=informe_ronda&id_ronda` → **notas individuales de cada evaluador** por póster (o "pendiente") + promedio entre todos; en Ronda 2+ solo los pósters clasificados · `action=resumen` → resumen por evento para el panel admin |
| `backend/api/Rondas.php` | `POST` | **3 y 4** (`require_role([3, 4])`) | `crear_ronda`, `actualizar_ronda`, `abrir_ronda`, `cerrar_ronda` (solo cierre final), **`cerrar_y_pasar`** (acción única de corte + reasignación aleatoria con `evaluadores_siguiente`), `previsualizar_corte`, `corregir_seleccion`, `previsualizar_podio`, `publicar_podio`, `deshacer_podio` |
| `backend/api/Notificaciones.php` | `GET` | Cualquier sesión (`require_login`) | Novedades de rondas/premios para la campana, **filtradas por `$auth['id']`**: usuario (póster que pasó de ronda, premio), evaluador (ronda abierta, pendientes), admin/super admin (corte confirmado, podio publicado) |
| `backend/api/includes/RondasHelper.php` | — | — | Lógica compartida: **única implementación de la elegibilidad** (§5.3), ranking por ronda, detección de empates y plantilla de correo con contenido escapado |
| `BD/migracion_rondas.sql` | — | — | Migración **idempotente** (se puede ejecutar dos veces) que crea `rondas` y `selecciones`, agrega `id_ronda` a `criterios_evaluacion`, `evaluaciones`, `evaluaciones_detalles` y `asignaciones_evaluadores`, rompe los UNIQUE que impedían evaluar en dos rondas y conserva los datos actuales |

### Modificados

| Endpoint | Método | Roles exigidos | Cambio |
|---|---|---|---|
| `backend/api/Evaluaciones.php` | `POST` | **2, 3 y 4** (`require_role`) | Recibe `id_ronda`; **`id_evaluador` siempre es `$auth['id']`** (se ignora el del cliente); valida ronda abierta releyéndola dentro de la transacción, no autor, elegibilidad y que los criterios pertenezcan a la ronda; recalcula `promedio_total`; rate limit anti automatización |
| `backend/api/Evaluaciones.php` | `GET` | Cualquier sesión (`require_login`) | Devuelve el detalle de criterios **de la ronda pedida** y su estado; cada usuario solo consulta lo suyo (su póster o sus propias notas; admin ve todo) |
| `backend/api/TablaPosters.php` | `GET` | (endpoint histórico sin token: deuda fuera de alcance) | Nuevos parámetros `id_ronda`/`ronda`, `orden`, `solo_seleccionados`, `todas_las_rondas`; columnas `id_ronda`, `nombre_ronda`, `promedio_ronda`, `n_evaluaciones_ronda`, `evaluadores_ronda`, `pendientes_ronda`, `estado_evaluacion`, `seleccionado`, `seleccion_manual`, `lugar`, `premio`, `es_autor`, `calificable`, `motivo_bloqueo`, `ronda_cerrada` y `rondas[]`; en ronda 2+ lista los **seleccionados** con el motivo de bloqueo por conflicto de intereses |
| `backend/api/Criterios.php` | `GET/POST/DELETE` | (endpoint histórico sin token) | `id_ronda` en el listado y al crear/editar; **no deja borrar** un criterio que ya tenga evaluaciones |
| `backend/api/AsignarEvaluadores.php` | `POST` | (endpoint histórico sin token) | Los `INSERT` envían `id_ronda` (la ronda 1 del evento del póster). Sin cambios de comportamiento |

---

## 2. Verificación de seguridad (§8.6)

Ejecutado con el servidor real (`cd backend && php -S 0.0.0.0:8000`) sobre `http://localhost:8000/api/Rondas.php`:

| Caso | Respuesta exacta | HTTP |
|---|---|---|
| `GET ...?action=participantes&id_ronda=2` **sin token** | `{"status":"error","success":false,"message":"No autenticado. Inicia sesión."}` | **401** |
| `POST {"accion":"confirmar_corte","id_ronda":1,"cupos":5}` **sin token** | `{"status":"error","success":false,"message":"No autenticado. Inicia sesión."}` | **401** |
| Mismo `POST` con **token de Evaluador** | `{"status":"error","success":false,"message":"Sin permiso para esta operación."}` | **403** |

Casos adicionales probados a mano (§8.2):

| Intento | Resultado |
|---|---|
| Evaluador califica **su propio póster** | `403 "No puedes evaluar tu propio póster (conflicto de intereses)."` |
| Evaluador califica un póster **no asignado** (cualquier ronda) | `403 "Este póster no te fue asignado en esta ronda."` |
| Evaluador califica en una **ronda cerrada** | `409 "La ronda está cerrada: sus evaluaciones ya no se pueden modificar."` |
| Evaluador califica un póster **no seleccionado** (ronda 2+) | `403 "Este póster no fue seleccionado para esta ronda."` |
| Evaluador **repite** un póster ya calificado en otra ronda | `403 "Ya calificaste este póster en una ronda anterior."` |
| Guardar evaluación **sin `id_ronda`** | `400 "Debes indicar la ronda de evaluación (id_ronda)."` |
| Intentar **cerrar/cortar** una ronda con pósters sin calificar | `409 "No se puede cerrar la ronda: faltan N pósters por calificar."` + `pendientes[]` con títulos (solo se cierra con `forzar_cierre_pendientes: true`) |
| Asignar **2 evaluadores** en la Ronda 1 | `400 "En la Ronda 1 solo puede haber UN evaluador por póster."` |
| Evaluador envía un criterio de **otra ronda** | `400 "Uno de los criterios enviados no pertenece a esta ronda."` |
| Confirmar corte dos veces seguidas | No duplica selecciones (`UNIQUE` + `notificado=1`) ni correos |

Además: identidad solo por token, prepared statements en todas las consultas, enteros concatenados pasados por `intval()` y validados, errores técnicos solo al log (`error_log`), contenido de usuario escapado en los correos (`htmlspecialchars`) y en el certificado, correos solo al `usuario.correo` del póster y rate limit (`auth_rate_limit`) en guardar evaluación, confirmar corte, corregir selección y publicar podio.

---

## 3. Responsive (§9) — capturas y medidas

Capturas en `verificacion-responsive/` (Chromium headless + CDP con
`Emulation.setDeviceMetricsOverride`, método de la sección 8 de
`CONTEXTO-DESARROLLO.md`). Medidas crudas en `verificacion-responsive/medidas.json`.

| Vista | Ancho | Panel (px) | Tarjeta (px) | Rejilla | `scrollWidth`/`clientWidth` | Alto botones | Filtros/acciones |
|---|---|---|---|---|---|---|---|
| `rondas-panel-1440.png` | 1440 | 1184 | 1120 | 1 columna | 1440/1440 (sin scroll) | 55 px | fila (3 campos + botones a la par) |
| `rondas-panel-768.png` | 768 | 720 | 688 | 1 columna | 768/768 (sin scroll) | 55 px | 2 filas |
| `rondas-panel-390.png` | 390 | 342 | 315 | 1 columna | 390/390 (sin scroll) | 55 px | columna, botones a todo el ancho |
| `certificados-1440.png` | 1440 | 1184 | 1120 | — | 1440/1440 | 55 px | modal de certificados |
| `superadmin-rondas-seccion-1440.png` | 1440 | — | 1440 | 2 col (tarjetas del hero) | 1440/1440 | — | sección 8ª "Rondas y premios" |
| `evaluador-1440.png` | 1440 | — | 1440 | 2 col | 1440/1440 | 41 px | pestañas de ronda en fila |
| `evaluador-390.png` | 390 | — | 390 | 1 col | 390/390 | 41 px | pestañas a todo el ancho |
| `usuario-1440.png` / `usuario-390.png` | 1440 / 390 | — | 1440 / 390 | 2 col / 1 col | sin scroll | — | columna "Estado por ronda" |

Notas:
- **Ninguna vista provoca scroll horizontal de la página** (`scrollWidth === clientWidth` en los tres anchos).
- Las tablas anchas (ranking del corte, podio) se desplazan **dentro** de
  `.contenedor-tabla` (la tarjeta usa `minmax(0, 1fr)` + `min-width: 0` para no
  empujar el layout).
- Toda la información crítica (promedio, seleccionado, lugar, estado) está
  visible, **no** oculta en `hover`. Botones táctiles ≥ 40 px (55 px los del
  panel, 41 px los de pestañas) y separación ≥ 8 px.
- Modales con `max-height: calc(100vh - 2rem)` y scroll interno.
- Rejilla de datos del panel: 3 campos de configuración en fila a 1440/768 y en
  columna a 390; las tarjetas de ronda van **apiladas en todos los anchos** a
  propósito (cada una contiene la tabla ancha del ranking, según el mock de §6.1).

---

## 4. Qué quedó fuera y por qué

| Pendiente | Motivo |
|---|---|
| Exigir token en `TablaPosters.php`, `Criterios.php`, `AsignarEvaluadores.php`, `Espacios.php`, `Categorias.php`, `Eventos.php` | **Fuera de alcance explícito** (§12): es la deuda que ya documenta `SEGURIDAD-CAMBIOS.txt`. Todo el código nuevo sí nace con `require_role()`/`require_login()` |
| Rondas 3 o posteriores en la interfaz | §12: el modelo ya las soporta (`rondas.numero`, selecciones por ronda), la interfaz no |
| Reasignar o mover pósters de evento, historial/auditoría de notas, panel público de resultados | §12 (fuera de alcance) |
| Cambios en `ProtectedRoute`, `src/auth.js`, parche de `fetch`, paleta, fuentes, header | Prohibido por §10 |
| Dependencias npm nuevas (jsPDF, html2canvas, Tailwind…) | Prohibido por §2.9 y §12; el certificado se genera con `window.open` + `document.write` (patrón de `ListadoUbicaciones.jsx`) |

---

## 5. Cómo probarlo

1. **Base de datos** (una sola vez):
   ```bash
   mysql -u root -p posters < BD/migracion_rondas.sql
   ```
   Es idempotente: se puede volver a ejecutar sin romper nada. Al final imprime
   las tablas para verificar que las 2 evaluaciones, sus detalles y las
   asignaciones quedaron en `id_ronda = 1`.
2. **Backend**: `cd backend && php -S 0.0.0.0:8000`.
3. **Frontend**: `npm run dev` (o `npm run build` + `npm run preview`).
4. **Escenario completo** (§11): entrar como super admin (`camilo@gmail.com`) →
   sección **Rondas y premios** → *Ver ranking* → *Previsualizar corte* → quitar
   y agregar a mano → *Confirmar corte* (revisa el resumen) → verificar
   `/tmp/correo_debug.txt` y la campana del autor → calificar en la ronda 2 como
   evaluador (no el autor) → *Previsualizar podio* → *Publicar podio* →
   *Certificado* por ganador (o *Descargar todos*).
   Contraseña de todos los usuarios de prueba: `usuario123`.

> **Estado de los datos al entregar**: además de la migración, se dejó un
> recorrido de demostración en la base de datos (ronda 1 cerrada con 2 cupos,
> ronda 2 creada con 3 criterios propios, evaluaciones de prueba de los
> evaluadores 14 y 19, selección de los pósters 61 y 62 y podio publicado con
> 🥇 1er lugar / 🥈 2do lugar) para que se vean la tabla de ganadores y los
> certificados. Para empezar de cero: restaurar el volcado previo a la migración
> y volver a aplicar `BD/migracion_rondas.sql`, o usar *Deshacer podio* /
> *Rehacer selección* desde el panel.
