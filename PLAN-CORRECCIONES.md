# Informe de Correcciones Aplicadas

Este documento detalla las soluciones técnicas implementadas para resolver los problemas reportados en el sistema de gestión de pósteres.

---

## 1. Botón "Cargar Póster" (Fondo blanco / invisible en tema claro)

### Diagnóstico
* En `src/index.css`, existía una regla en `@media (prefers-color-scheme: light)` con `button { background-color: #f9f9f9; }` y `a { color: #ffffff; }`. Cuando el navegador o sistema operativo del usuario tenía tema claro, los botones heredaban fondo `#f9f9f9` (casi blanco) y mantenían texto blanco, haciéndose invisibles.
* Las modificaciones locales previas no habían sido compiladas ni subidas al servidor remoto (`172.42.0.130:5173`), el cual continuaba sirviendo el bundle compilado anterior (`index-B2H8-Yth.css`).

### Solución Aplicada
1. **`src/index.css`**: Se removieron por completo las reglas globales `button { background-color: #f9f9f9; }` y `a { color: #ffffff; }` dentro de `@media (prefers-color-scheme: light)`.
2. **`src/components/roles/generales/roles.css`**: Se fijó para `.btn-cargar-posters` el color institucional de fondo `#00acc9 !important`, color de texto `#ffffff !important`, borde institucional `#00acc9 !important`, hover `#0093ad !important`, y dimensiones máximas adecuadas tanto en escritorio (`max-width: 260px`) como en pantallas móviles (`@media (max-width: 640px)`).
3. **`src/components/roles/usuario/HomePageUsuario.jsx`** y **`src/components/roles/evaluador/HomePageEvaluador.jsx`**: Se reforzó el botón con `className="btn-cargar-posters boton-primario"`.

---

## 2. Botón "Ver más" en Pósteres Publicados

### Diagnóstico
* En `src/components/roles/generales/MostrarPosters.jsx`, la condición para renderizar el enlace era:
  ```jsx
  {limite && verMas && postersFiltrados.length > limite && (
  ```
  Al configurar `limite = 3` (en la vista previa del inicio de admin y super admin), si existían 1, 2 o 3 pósteres, la condición era falsa, ocultando el enlace "Ver más...". Sin ese enlace, el administrador no podía abrir el modal completo con todas las acciones y funciones administrativas.

### Solución Aplicada
* Se cambió la condición en `MostrarPosters.jsx` a:
  ```jsx
  {limite && verMas && (postersFiltrados.length > 0 || posters.length > 0) && (
  ```
  Ahora el botón "Ver más..." se muestra siempre que exista al menos un póster en la plataforma.

---

## 3. Bucle de Parpadeo en Tabla, Conteo de Pósteres y Evaluadores Eliminados

### A. Bucle / parpadeo de carga rápida de la tabla
* **Causa Raíz**: En `MostrarPosters.jsx`, existía un ciclo de dependencias circular:
  1. `posters` estaba en las dependencias de `rondaVista = useMemo(..., [idRonda, rondas, posters])`.
  2. `rondaTrabajoId = idRonda || rondaVista.id_ronda`.
  3. `rondaTrabajoId` estaba en las dependencias del `useEffect` de carga.
  4. Al cambiar o eliminar pósteres, `posters` cambiaba $\rightarrow$ recalculaba `rondaVista` $\rightarrow$ cambiaba `rondaTrabajoId` $\rightarrow$ disparaba `useEffect` $\rightarrow$ `setLoading(true)` (la tabla se descargaba y quedaba vacía) $\rightarrow$ llegaban nuevos datos $\rightarrow$ `setPosters` volvía a disparar el ciclo en bucle.
* **Solución**:
  - Se eliminó `posters` del cálculo de `rondaVista`.
  - Se retiró `rondaTrabajoId` de las dependencias de carga del `useEffect`.

### B. Super Admin solo veía 1 póster (pósteres de otros eventos ocultos)
* **Causa Raíz**: Cuando el usuario seleccionaba "Todas las rondas" (`idRonda = ""`), la línea `const rondaFiltro = soloMisPosters ? idRonda : rondaTrabajoId;` forzaba `rondaTrabajoId` (una sola ronda, p. ej. Ronda 1 de Sistemas).
  Al pasar `?id_ronda=1` a `backend/api/TablaPosters.php`, el backend ejecutaba:
  `$idEvEfectivo = $ronda['id_evento'];`
  `WHERE p.id_evento = $idEvEfectivo`
  Esto filtraba todos los pósteres del evento de Ingeniería Civil, mostrando únicamente los de Sistemas.
* **Solución**:
  - En `MostrarPosters.jsx`, se estableció `const rondaFiltro = idRonda;`.
  - Solo se envía `id_ronda` al endpoint cuando el usuario ha seleccionado explícitamente una ronda en el desplegable. En "Todas las rondas", no se restringe por ronda, permitiendo que el Super Admin vea todos los pósteres de todos los eventos.

### C. Evaluadores eliminados apareciendo en la asignación
* **Causa Raíz**: En `backend/api/AsignarEvaluadores.php`, la consulta SQL en `obtenerEvaluadoresYAsignaciones` excluía al autor y a profesores, pero omitía verificar el estado del usuario (`u.activo = 1 AND u.desactivado = 0`). Cuando un usuario evaluador era eliminado mediante `backend/api/TablaUsuarios.php`, su registro quedaba con `desactivado = 1`, por lo que continuaba apareciendo en el modal de asignación.
* **Solución**:
  - En `backend/api/AsignarEvaluadores.php`, se añadió la cláusula obligatoria `AND u.activo = 1 AND u.desactivado = 0` en la consulta `SELECT` y validación de integridad previa al guardado en `guardarAsignacion`.
  - En `backend/api/SubirPosters.php` y `src/components/formularios/CargarPosters.jsx`, se propagó el aviso cuando no hay evaluadores disponibles debido a conflicto de intereses (autor o profesores del póster), indicando formalmente que se requiere asignación manual.

---

## 4. Despliegue al Servidor

Para reflejar estos cambios en el servidor en producción (`http://172.42.0.130:5173/`), se debe sincronizar el repositorio y compilar los archivos del frontend:

```bash
# 1. Traer los cambios confirmados en git:
git pull origin main

# 2. Generar el bundle de producción actualizado:
npm run build
```
