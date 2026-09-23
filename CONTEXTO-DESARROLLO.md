# CONTEXTO DE DESARROLLO — app-posters

Documento de traspaso de sesión para continuar rediseñando el frontend de las demás
secciones con el mismo lenguaje visual ya aplicado en la Homepage.

---

## 1. Resumen y estado

- App **React + Vite 7** (pure frontend, JS/JSX). No hay backend funcional: las páginas
  de "roles" y formularios usan datos estáticos/placeholder. No tocar lógica de negocio.
- La **Homepage está terminada y verificada** (header, hero, comunidad, novedades,
  posters con descarga de plantilla, FAQ y footer — detalles en la sección 5).
- Se aprobó conservar su estado actual; el siguiente objetivo es aplicar el mismo
  lenguaje visual a: **páginas de roles** (`/superadmin`, `/admin`, `/evaluador`,
  `/usuario`) y **formularios** (`/registro`, `/login`, `/CargarPosters`).

## 2. Stack y comandos

```bash
npm run dev          # servidor de desarrollo Vite
npm run build        # build de producción (verificar que pase limpio)
npm run preview      # sirve dist
npm run lint         # eslint (calidad de código)
```

- Build actual: `✓ built` (~140 módulos, genera `dist/assets/index-*.js` y
  `dist/assets/index-*.css`). Antes de cada entrega, correr `npm run build`.
- Para pruebas de medidas/visual: servir `dist` con un estático y abrir la app en
  Chromium headless vía CDP (scripts de ejemplo en la sección 8).

## 3. Mapa de archivos

```
src/
  App.jsx                      # Router y Layout (menú "FORMULARIOS DISPONIBLES")
  App.css, index.css, main.jsx
  analytics.js                 # react-ga4 (no modificar lógica)
  components/
    homePage/                  # HOMEPAGE (terminada)
      HomePage.jsx  Header.jsx  Carrusel.jsx  CuadrosTextoComunidad.jsx
      PreguntasFrecuentes.jsx  HomePage.css        # única hoja de la Homepage
    generales/
      Footer.jsx               # Footer compartido (usado en Homepage y roles)
      VolverArriba.jsx         # Scroll-top institucional
      VolverArriba.css         # Botón flotante #132740/#00acc9 (NUEVO)
    formularios/
      Login.jsx  Registro.jsx  CargarPosters.jsx  Formulario.css
    roles/
      generales/
        roles.css              # CSS GLOBAL de todas las páginas de roles (REESCRITO institucional)
        Evaluar.css            # Modales evaluación (REESCRITO)
        ModalEvaluacion.jsx    # NUEVO: modal Calificar/Editar con criterios dinámicos
        MostrarPosters.jsx/.Admin, Usuarios.jsx, Categorias.jsx, SolicitudesUsuarios.jsx
        Cuenta.jsx, EditarPoster/Usuario.jsx, DetallesCalificacionModal.jsx, EvaluarPosterModal.jsx
        GestionEspaciosModal.jsx, ListadoUbicaciones.jsx (print corregido), TarjetaPosterQR.jsx
      admin/        HeaderAdmin.jsx      HomePageAdmin.jsx
      evaluador/    HeaderEvaluador.jsx  HomePageEvaluador.jsx  EvaluacionPosters.jsx
      usuario/      HeaderUsuario.jsx    HomePageUsuario.jsx
      super_admin/  HeaderSuperAdmin.jsx HomePageSuperAdmin.jsx  Estilos.css (depurado)  GestionCriterios.jsx GestionEventosModal.jsx
public/
  img/logoucc.png              # logo UCC (la Homepage lo usa como "píldora" blanca)
  img/poster.png               # plantilla pública del póster (NO borrar; se descarga)
```

Rutas (`src/App.jsx`): `/`, `/solo-home` → HomePage · `/registro`, `/login`,
`/CargarPosters` → formularios · `/superadmin`, `/admin`, `/evaluador`, `/usuario`
→ páginas de roles.

## 4. Paleta y lenguaje visual UCC

- Colores base:
  - `#132740` azul institucional (fondos oscuros: header, paneles, secciones).
  - `#00acc9` cian (botones primarios, acentos, hover).
  - `#80ba27` verde (acentos tarjetas).
  - `#cad400` lima (eyebrow/badges, detalles).
  - `#5f5e5e` gris texto secundario · `#f5f7f8` fondos claros alternos ·
    `#ffffff` fondos de tarjeta.
- Convenciones ya aplicadas en la Homepage (replicar en el resto):
  - Tarjetas blancas, `border-radius: 16–20px`, `border-top: 4px solid` con acento
    variable (`var(--acento-...)`), `box-shadow: 0 6px 20px rgba(19,39,64,0.08)`,
    hover con elevación (`translateY(-6/-8px)` + sombra mayor).
  - Botones: primario cian con padding generoso; secundarios en contorno.
  - Eyebrow de sección: label uppercase, letter-spacing, color `#cad400`.
  - Títulos `h2` en `#132740`, font-weight alto; párrafos `#5f5e5e`.
  - Grids responsive típicos: base N columnas → `@media ≤1020/990` → 2 → `≤640` → 1.

## 5. Homepage (terminada) — estructura y decisiones

1. **Header** (`Header.jsx`): sticky, fondo `#132740`, sombra. `.header-contenedor`
   es grid; en móvil (`≤990`) pasó a `grid-template-columns: minmax(0,1fr) auto`
   (logo izquierda, acciones derecha). Contiene modales Login/Registro.
   - Menús móviles: paneles flotantes oscuros (`top:56px`, `right:0.75rem`,
     radius 12, sombra con overlay `0 0 0 100vmax rgba(19,39,64,0.4)`); por defecto
     `display:none`, se abren con `.activo`. Botón X `boton-cerrar` visible solo móvil.
   - Iconos hamburguesa/usuario en **blanco**.
   - **NO hay botón de búsqueda** (se eliminó por solicitud del usuario).
2. **Hero** (`#inicio`): `.hero-tarjeta` grid texto + imagen. Eyebrow lima, `h1`
   blanco `fw800`, `p` `rgba(255,255,255,0.84)`, botones `boton-primario` (cian) y
   `boton-preguntas-frecuentes`. Fondo con resplandores (`hero-detalle`).
3. **Comunidad** (`#comunidad`): 3 tarjetas `.tarjeta-comunidad` (icono 64px en
   color-mix del acento, borde superior de acento). Grilla: flex 3 a la par en
   escritorio → `≤850` grid 2 col → `≤640` 1 col (compacto, igual que posters).
4. **Novedades** (`#novedades`): carrusel `Carrusel.jsx` (una `<img>` con `key`
   = índice; flechas `.left/.right` y dots). OJO: `.slide_direction` tiene
   `pointer-events:none`; las flechas ya tienen `pointer-events:auto`.
5. **Posters** (`#posters`): 4 `.tarjeta-proceso` (grid 4→2→1) + `.aviso-proceso` +
   apartado `.poster-semestre` con `.tarjeta-maqueta` (imagen `/img/poster.png` y
   botón `.boton-descargar-poster` con `<a download="Maqueta-Poster.png">`) y
   `.tarjeta-recomendaciones` (lista 4 ítems con ✔ verde).
6. **FAQ** (`PreguntasFrecuentes.jsx`): acordeón de 8 preguntas reales (no es texto
   relleno; los enlaces .pdf/.jpg/.png que menciona son descriptivos, no hay carga).
7. **Footer** compartido (`Footer.jsx`): 4 columnas (marca+logo, enlaces, contacto,
   redes+créditos). Conserva iconos sociales a propósito. Bloque CSS **duplicado e
   idéntico** en `HomePage.css` y `roles.css` — si cambias el footer, actualiza AMBOS.

## 6. REGLA DE ORO — CSS global y colisión con `roles.css`

**Vite empaqueta todos los CSS importados en un único bundle por página.** En la
aplicación actual `roles.css` (importado por los componentes de roles) viaja en el
mismo bundle y, por orden, suele quedar **después** de `HomePage.css` → en empate de
especificidad gana `roles.css`.

Consecuencia vista en la Homepage (y la causa del sobre-ajuste):
- `.inicio` quedaba `display:grid`/`flex` desde roles.css.
- `.texto-inicio` flex centrado con `min-height:300px`, y en móvil `h1` negro y `p`
  gris (regla `@media ≤1020` de roles.css).
- `.encabezado` `display:flex` con `margin:1rem 2rem 0` (encogía el header).
- `.logo-ucc` `height:50px` y `.boton-usuario button` gris `#5f5e5e`.

Solución aplicada (NO editar `roles.css` sin consentimiento: las páginas de roles
dependen de él):
- Overrides al **final** de `HomePage.css` con anclas exclusivas de la Homepage:
  - `.contenido-home .inicio`, `.contenido-home .texto-inicio` (`.contenido-home`
    es el `<main>` de la Homepage; no existe en las páginas de roles).
  - `.contenido-home .texto-inicio h1|p` (blanco).
  - `.encabezado:has(> .header-contenedor)` (el header de la Homepage es el **único**
    que contiene `.header-contenedor`).
- Prefijo `.encabezado` en selectores del header (especificidad 0,2,0) para ganar a
  roles.css sin ancla.

**Implicación para el resto del trabajo:**
- Al estilizar cualquier clase compartida (`.footer*`, `.menu-*`, `.encabezado`,
  `.logo-ucc`, `.boton-*`, `.texto-inicio`, `.inicio`) recuerda que `roles.css` gana
  los empates: sube la especificidad o usa un ancla exclusiva de la sección.
- Los **headers de roles** usan exactamente las mismas clases que el header de la
  Homepage (`.encabezado`, `.logo-nav`, `.menu-nav`, `.menu-usuario`,
  `.boton-hamburguesa`, `.boton-usuario`, `.acciones-header`, `.boton-cerrar`).
  roles.css los estiliza. Ten en cuenta que las reglas de `HomePage.css` con prefijo
  `.encabezado` se aplican a TODOS los headers (incluidos los de roles) salvo que una
  regla de roles.css las gane por empate. Para rediseñar los headers de roles:
  editar sus componentes y/o roles.css consultando antes con el usuario.
- La paleta/lenguaje de la sección 4 debe reutilizarse tal cual para dar coherencia.

## 7. Trabajo pendiente / sugerido para continuar

- ✅ **Headers de roles** (`HeaderSuperAdmin.jsx`, `HeaderAdmin.jsx`, `HeaderEvaluador.jsx`, `HeaderUsuario.jsx`): reescritos a `header-contenedor` institucional oscuro (`grid auto 1fr auto` / `gap 0.75rem` / `logo gap 12px` / `menu-enlace 0.88rem margin 0 0.45rem white-space nowrap`), logo píldora blanca, `menu-enlace`/`enlace-login`/`boton-registro`, iconos SVG blancos, paneles móviles oscuros `≤990`. Compresión `991-1300px` a `0.82rem/0.32rem` y `1301-1450px` a `0.86rem/0.38rem` para Super Admin 5 enlaces (fix amontonado).
- ✅ **Tarjetas y tablas de roles** base (`roles.css` 850→~1260 líneas, `Evaluar.css` 284→~410): sistema tarjetas `border-top 4px #00acc9 radius 20 shadow 0 6px 20px hover translateY-8`, tablas `thead #132740`, `contenedor-tabla` responsive, `badge-rol`, `seccion-eyebrow`.
- ✅ **Formularios** (`Login.jsx`, `Registro.jsx`, `CargarPosters.jsx`, `Formulario.css`): redesign institucional; `CargarPosters` con modo dual: `cerrarModal? <div formularios 560px> : <section formularios-page>`, fix doble overlay en `HomePageUsuario` (antes `modal-cargar-posters > modal` + `formularios-page` gris).
- ✅ **Generales `src/components/generales/`** (`Footer.jsx` + `seccion-footer`, `VolverArriba.jsx`/`VolverArriba.css`): botón flotante `48px #132740→#00acc9 hover translateY-3` responsive `≤640 40px`.
- ✅ **Generales `src/components/roles/generales/`** (`roles.css`, `Evaluar.css`, `Cuenta.jsx`, `EditarPoster.jsx`, `EditarUsuario.jsx`, `DetallesCalificacionModal.jsx`, `EvaluarPosterModal.jsx`, `GestionEspaciosModal.jsx`, `ListadoUbicaciones.jsx`, `TarjetaPosterQR.jsx`): `formularios-header/eyebrow/body`, `campo-formulario`, `poster-info-box`, `filtros 2px #d5ddd3 focus cian`.
- ✅ **Super Admin** (`HomePageSuperAdmin.jsx` 422 líneas, `HeaderSuperAdmin.jsx`, `Estilos.css` depurado a solo `solicitar-registro cian + error-mensaje`, `GestionCriterios.jsx` 227→~140, `GestionEventosModal.jsx` 288→~180): `header-contenedor` oscuro; hero `texto-inicio h1 #132740 / p #5f5e5e` fix blanco invisible; `texto-tarjetas h3`; 7 secciones (`pendientes/criterios/posters/espacios/usuarios/categorias/eventos`) en `contenedor-tabla`/`table` + `boton-primario`/`badge-rol`/`seccion-eyebrow`; `GestionCriterios/Eventos` con `formularios-header/body/campo-formulario` + `filtros` responsive.
  - 🔧 Correcciones: header comprimido `991-1300`; `inicio max-width 1280` + `grupo-tarjetas 2col→1col ≤640` fix desborde; `preview-* padding 0` iguala `Usuarios Pendientes` a `Criterios`.
- ✅ **Admin** (`HomePageAdmin.jsx`): `#espacios` migrado de `eventos/tabla-contenedor/tabla-general/badge inline` a `contenedor-tabla/table` + `badge-rol` + `boton-primario` centrado; `pendientes/posters/usuarios/categorias` con `seccion-eyebrow`; tamaño tabla ya igualado.
- ✅ **ListadoUbicaciones** (`ListadoUbicaciones.jsx`): `cargarDatosUbicaciones` deduplica espacios por `Map(id_espacio)`, agrupa por `nombre_espacio`, añade grupo `Sin ubicación asignada` para pósters huérfanos (todos se ven, no se repiten); `exportarExcel` incluye huérfanos; `imprimirListado` usa `useRef + window.open` con HTML aislado (`break-inside:avoid`, thead cian) en vez de `window.print()` global que generaba 6 páginas repitiendo hero/imagen; botones `no-print`.
- ✅ **Evaluador** (`MostrarPosters.jsx` + `ModalEvaluacion.jsx` NUEVO + `Evaluar.css`): `cargarEvaluacionesParaPosters` fija `existente:true/false + editando:false`; tabla evaluador solo lectura (span `toFixed(1)` + observaciones truncadas `—`); columna Acción con `existente? btn-evaluar ✏️ Editar : btn-asignar ⭐ Calificar` (`Evaluar.css:306` pill `999px` elevado `shadow translateY-2` cian/verde contorno); click abre `ModalEvaluacion` (poster + criterios dinámicos con descripción, input 78px cian, promedio, textarea observaciones) en `modal-overlay`/`modal-contenido-evaluar`; `EvaluarPosterModal`/`DetallesCalificacionModal` también centrados; `Evaluar.css` header título centrado `position:relative + flex center` + `btn-cerrar absolute top-right` fix responsive (antes `flex-direction column` bajaba botón).
- ✅ **Acciones evaluador** (`Evaluar.css:306`): `btn-accion-tabla` pill `999px fw700 shadow 0 4px 12px`, `btn-asignar #00acc9→#0093ad` y `btn-evaluar #fff/#80ba27→#80ba27/#fff` con hover elevado (antes plano `4px` sencillo).
- ✅ **Usuario** (`HomePageUsuario.jsx`, `CargarPosters.jsx`): eliminado doble `modal > modal-cargar-posters + formularios-page gris`; ahora single `modal` + `formularios 560px`; `CargarPosters` modo modal vs standalone.
- ✅ **Filtros + Ver más** (`MostrarPosters.jsx:533`, `SolicitudesUsuarios.jsx:148`, `Usuarios.jsx:241`): `ver-mas` movido dentro de `.filtros` al lado de `Buscar por...` / `Todos los roles` (a la derecha con `margin-left:auto` en `roles.css:540`); `HomePageSuperAdmin` `#criterios .boton-primario !important` fix blanco sin contraste.
- ✅ **Espacios botones** (`HomePageSuperAdmin.jsx:286`): `grupo-botones-espacios {flex nowrap gap1rem center}` + `≤640 {gap 0.6rem + font 0.82rem}` para que `Administrar / Crear` y `Ver Listado` queden lado a lado no debajo; Admin ya con `text-center + boton-primario` único.
- ✅ **z-index de modales**: `.modal-registro` y `.modal` a `z-index: 9999` en `HomePage.css`, `roles.css`, `Formulario.css` y `HomePageSuperAdmin.css`.
- Evaluar si el menú "FORMULARIOS DISPONIBLES" del `Layout` en `App.jsx` debe ocultarse/rediseñarse (hoy navegación temporal de desarrollo).
- Luego de cada cambio: `npm run build` y verificación visual/geométrica.

## 8. Verificación con pruebas (método usado en esta sesión)

Regenera scripts temporales (son volátiles en `/tmp/opencode`):

```bash
# Servir el build
python3 -m http.server 8123 --directory dist
```

Patrón de medición con Chromium headless + CDP (Node ≥ 22 con fetch/WebSocket):

```js
const chrome = spawn('chromium', ['--headless=new','--disable-gpu','--no-sandbox',
  '--window-size=390,844','--remote-debugging-port=9230','http://127.0.0.1:8123']);
// 1) fetch http://127.0.0.1:9230/json, tomar webSocketDebuggerUrl de la página
// 2) conectarse, Page.enable, Runtime.enable, esperar ~4.5s
// 3) Runtime.evaluate y leer getBoundingClientRect/getComputedStyle
```

Puntos de control:
- Hero centrado ocupando el ancho (`~1280px` en desktop, p. ej. `x=73 w=1280`).
- Header móvil: logo izquierda, acciones pegadas a la derecha, sin solape.
- Menús móviles ocultos por defecto (`display:none`) → sin pantalla oscurecida.
- Sin overflow horizontal (`scrollWidth == clientWidth`).
- Colores de texto del hero blancos en móvil.

## 9. Restricciones del proyecto

- **No hay backend**: no modificar lógica de `express`/`mysql2`/analytics ni inventar
  datos. Los apartados de roles/formularios se deben cambiar solo en el **front**.
- **No añadir dependencias** sin confirmar (evitar librerías nuevas pesadas).
- **No borrar** `public/img/poster.png` (usado por el botón de descarga) ni
  `logoucc.png`.
- **No renombrar/reescribir estructura** de páginas internas sin preguntar al usuario.
- Mantener consistencia visual con la paleta (sección 4).
- No editar `roles.css` para arreglar la Homepage; usa el mecanismo de overrides.
- Reportar siempre el resultado de `npm run build` al finalizar.

## 10. Notas de Git

- Rama `main`, remoto `origin` = `https://github.com/jhank-beats/app-posters.git`.
- Último commit: `7fac71f` ("Integra generacion de codigos QR en vistas de posters").
- NO hacer commit/push salvo que el usuario lo pida explícitamente.
- Archivos de la Homepage modificados frente al último commit: `HomePage.css`,
  `HomePage.jsx`, `Header.jsx`, `Footer.jsx` (compartido), `CuadrosTextoComunidad.jsx`,
  `PreguntasFrecuentes.jsx`, `roles.css` (footer duplicado actualizado).
- Archivos de formularios modificados: `Login.jsx`, `Registro.jsx`, `CargarPosters.jsx`, `Formulario.css` (modo dual modal 560px vs standalone).
- Archivos de generales modificados: `Footer.jsx`, `VolverArriba.jsx`, `VolverArriba.css`, `HomePage.css`/`roles.css` (footer).
- Archivos de roles/generales modificados: `roles.css` (1112→1284 líneas header/cards/tablas/filtros/grupo-botones), `Evaluar.css` (pill acciones + header centrado + btn-cerrar absolute), `ModalEvaluacion.jsx` (NUEVO), `MostrarPosters.jsx` (Calificar/Editar + modal), `Cuenta/EditarPoster-Usuario/Detalles/EvaluarPoster/GestionEspacios/ListadoUbicaciones/TarjetaPosterQR.jsx`, `SolicitudesUsuarios/Usuarios/MostrarPosters` (ver-mas dentro filtros).
- Archivos de super_admin/Admin/Evaluador/Usuario modificados: `HeaderSuperAdmin/Admin/Evaluador/Usuario.jsx` (header-contenedor institucional), `HomePageSuperAdmin/Admin.jsx` (eyebrow/contenedor-tabla/badge-rol/grupo-botones), `Estilos.css` (depurado), `GestionCriterios/EventosModal.jsx` (formularios-header/body).
