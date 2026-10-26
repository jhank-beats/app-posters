/**
 * scripts/generar_manual_fases_pdf.cjs
 * Genera el documento HTML ilustrado y el PDF de alta calidad explicando
 * detalladamente las 10 fases del sistema de pósteres en lenguaje sencillo
 * (sin tecnicismos) y con capturas de pantalla reales de cada etapa.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DOCS_DIR = path.join(__dirname, '..', 'docs', 'guia-flujo');
const HTML_PATH = path.join(DOCS_DIR, 'manual_fases_detallado.html');
const PDF_OUT_1 = path.join(__dirname, '..', 'FLUJO-OPERATIVO-POSTERS.pdf');
const PDF_OUT_2 = path.join(__dirname, '..', 'MANUAL-DETALLADO-FASES-POSTERS.pdf');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Guía Paso a Paso Ilustrada: Cómo Funciona el Evento de Pósteres UCC</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 10mm 14mm 10mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.42;
      font-size: 9.2pt;
    }

    .page {
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
      height: 274mm;
      max-height: 274mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* ENCABEZADO DE PÁGINA INTERNA */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #00acc9;
      padding-bottom: 5px;
      margin-bottom: 10px;
      flex-shrink: 0;
    }

    .doc-header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .doc-header-brand img {
      height: 28px;
    }

    .doc-header-titles h4 {
      font-size: 8.3pt;
      font-weight: 800;
      color: #0b2545;
      letter-spacing: 0.3px;
    }

    .doc-header-titles p {
      font-size: 7pt;
      color: #64748b;
    }

    .doc-header-tag {
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 7.3pt;
      font-weight: 700;
      text-transform: uppercase;
    }

    /* PIE DE PÁGINA INTERNA */
    .doc-footer {
      margin-top: auto;
      border-top: 1px solid #e2e8f0;
      padding-top: 5px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #64748b;
      flex-shrink: 0;
    }

    /* PORTADA */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(145deg, #06182c 0%, #0b2545 58%, #007791 100%);
      color: #ffffff;
      padding: 32px 36px;
      border-radius: 16px;
      height: 100%;
    }

    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cover-logo-box {
      background: #ffffff;
      padding: 8px 16px;
      border-radius: 10px;
      display: inline-block;
    }

    .cover-logo-box img {
      height: 40px;
      display: block;
    }

    .cover-badge {
      background: rgba(0, 172, 201, 0.25);
      border: 1px solid #00acc9;
      color: #38bdf8;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .cover-eyebrow {
      color: #38bdf8;
      font-size: 10pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.8px;
      margin-bottom: 8px;
      display: block;
    }

    .cover-title {
      font-size: 24pt;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 12px;
      color: #ffffff;
    }

    .cover-title span {
      color: #38bdf8;
    }

    .cover-subtitle {
      font-size: 10.5pt;
      color: #e2e8f0;
      line-height: 1.48;
      margin-bottom: 16px;
    }

    /* MAPA VISUAL EN PORTADA */
    .flow-roadmap {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      padding: 14px 16px;
      margin-top: 8px;
    }

    .flow-roadmap h4 {
      color: #cad400;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .flow-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 7px 14px;
    }

    .flow-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 8.2pt;
      color: #f1f5f9;
      background: rgba(15, 23, 42, 0.45);
      padding: 5px 9px;
      border-radius: 7px;
      border-left: 3px solid #00acc9;
    }

    .flow-num {
      background: #00acc9;
      color: #ffffff;
      font-weight: 800;
      font-size: 7.5pt;
      width: 19px;
      height: 19px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .roles-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
    }

    .role-card {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 10px 12px;
    }

    .role-card h5 {
      color: #38bdf8;
      font-size: 8.5pt;
      margin-bottom: 4px;
    }

    .role-card p {
      color: #cbd5e1;
      font-size: 7.6pt;
      line-height: 1.35;
      margin: 0;
    }

    .cover-bottom {
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .cover-meta p {
      font-size: 7.8pt;
      color: #cbd5e1;
      line-height: 1.4;
      margin: 0;
    }

    /* CONTENIDO INTERNO */
    h2.section-title {
      font-size: 12.5pt;
      font-weight: 800;
      color: #0b2545;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title-badge {
      background: #00acc9;
      color: #ffffff;
      padding: 2px 9px;
      border-radius: 6px;
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
    }

    .plain-explanation {
      background: #f0f9ff;
      border-left: 4px solid #00acc9;
      border-radius: 0 8px 8px 0;
      padding: 8px 12px;
      margin-bottom: 9px;
      font-size: 8.5pt;
      color: #0c4a6e;
      line-height: 1.42;
    }

    .plain-explanation strong {
      color: #082f49;
    }

    .step-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 9px 12px;
      margin-bottom: 9px;
    }

    .step-box-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }

    .step-badge {
      background: #0b2545;
      color: #ffffff;
      font-weight: 800;
      font-size: 7.4pt;
      padding: 2px 7px;
      border-radius: 5px;
      text-transform: uppercase;
    }

    .step-box-title {
      font-size: 9.6pt;
      font-weight: 800;
      color: #0b2545;
    }

    .step-instruction {
      font-size: 8.3pt;
      color: #334155;
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .screenshot-frame {
      border: 1px solid #334155;
      border-radius: 8px;
      overflow: hidden;
      background: #0f172a;
      box-shadow: 0 4px 12px rgba(11, 37, 69, 0.12);
      margin: 5px auto;
      text-align: center;
      width: 100%;
    }

    .screenshot-bar {
      background: #1e293b;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 5px;
      border-bottom: 1px solid #334155;
    }

    .bar-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
    }
    .bd-red { background: #ef4444; }
    .bd-yellow { background: #f59e0b; }
    .bd-green { background: #10b981; }

    .bar-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.5pt;
      color: #94a3b8;
      margin-left: 6px;
    }

    .screenshot-img {
      width: 100%;
      height: auto;
      max-height: 74mm;
      display: block;
      object-fit: contain;
      background: #ffffff;
    }

    .screenshot-img-tall {
      width: 100%;
      height: auto;
      max-height: 92mm;
      display: block;
      object-fit: contain;
      background: #ffffff;
    }

    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      align-items: stretch;
    }

    .step-tip {
      background: #f0fdf4;
      border-left: 3px solid #16a34a;
      padding: 6px 10px;
      font-size: 7.9pt;
      color: #166534;
      border-radius: 0 5px 5px 0;
      margin-top: 5px;
      line-height: 1.38;
    }

    .callout-warning {
      background: #fff7ed;
      border-left: 4px solid #ea580c;
      border-radius: 0 8px 8px 0;
      padding: 7px 11px;
      margin-top: 5px;
      font-size: 8pt;
      color: #7c2d12;
      line-height: 1.38;
    }

    ul.clean-list {
      padding-left: 16px;
      font-size: 8.1pt;
      color: #334155;
      line-height: 1.42;
    }

    ul.clean-list li {
      margin-bottom: 3px;
    }
  </style>
</head>
<body>

  <!-- ==================== PÁGINA 1: PORTADA E INTRODUCCIÓN SENCILLA ==================== -->
  <div class="page">
    <div class="cover-page">
      <div class="cover-top">
        <div class="cover-logo-box">
          <img src="img/logoucc.png" alt="Logo UCC">
        </div>
        <div class="cover-badge">Guía Explicativa Ilustrada · Paso a Paso</div>
      </div>

      <div>
        <span class="cover-eyebrow">Universidad Cooperativa de Colombia · Facultad de Ingeniería</span>
        <h1 class="cover-title">¿Cómo Funciona el Sistema de Pósteres?<br><span>Las 10 Fases Explicadas de Principio a Fin</span></h1>
        <p class="cover-subtitle">
          Esta guía fue diseñada en un lenguaje claro, sencillo y sin palabras técnicas para que cualquier docente, directivo, estudiante o jurado comprenda exactamente cómo se organiza, evalúa y premia un encuentro de pósteres académicos en la plataforma institucional.
        </p>

        <div class="roles-cards">
          <div class="role-card">
            <h5>👑 1. Los Administradores</h5>
            <p>Preparan los salones, aprueban cuentas, eligen quiénes son jurados, cierran las rondas y entregan los diplomas. Hay un <strong>Admin de Sistemas</strong>, un <strong>Admin de Civil</strong> y un <strong>Super Admin</strong> general.</p>
          </div>
          <div class="role-card">
            <h5>👨‍🎓 2. Los Autores (Docentes / Alumnos)</h5>
            <p>Suben su póster en PDF o imagen, indican quiénes son los autores y el profesor de la materia. El sistema les da su puesto físico en el salón y su código QR.</p>
          </div>
          <div class="role-card">
            <h5>⭐ 3. Los Evaluadores (Jurados)</h5>
            <p>Son profesores designados como jurados. Ven en su pantalla los pósteres que les tocaron, los califican de 1.0 a 5.0 y dejan sus observaciones.</p>
          </div>
        </div>

        <div class="flow-roadmap">
          <h4>🗺️ Resumen de las 10 Fases del Evento (Orden Cronológico)</h4>
          <div class="flow-grid">
            <div class="flow-item"><span class="flow-num">1</span> <div><strong>Preparar Ronda 1 y Salones:</strong> Definir cupos que pasan a la final, salones y qué se va a calificar.</div></div>
            <div class="flow-item"><span class="flow-num">6</span> <div><strong>Cerrar Ronda 1 (El Corte):</strong> El sistema ordena las notas y selecciona automáticamente a los mejores.</div></div>
            <div class="flow-item"><span class="flow-num">2</span> <div><strong>Registro y Cambio de Roles:</strong> Los participantes crean su cuenta, el Admin los aprueba y nombra a los Jurados.</div></div>
            <div class="flow-item"><span class="flow-num">7</span> <div><strong>Abrir la Ronda 2 (Gran Final):</strong> Se abre la segunda ronda únicamente con los pósteres que clasificaron.</div></div>
            <div class="flow-item"><span class="flow-num">3</span> <div><strong>Subir Pósteres y Puesto Físico:</strong> Se cargan los carteles y el sistema les da número de puesto consecutivo y QR.</div></div>
            <div class="flow-item"><span class="flow-num">8</span> <div><strong>Nuevos Evaluadores en Ronda 2:</strong> Se eligen jurados distintos a los de la Ronda 1 para evaluar la final.</div></div>
            <div class="flow-item"><span class="flow-num">4</span> <div><strong>Asignar Jurados sin Conflicto:</strong> Se asigna evaluador cuidando que nadie califique su propio curso.</div></div>
            <div class="flow-item"><span class="flow-num">9</span> <div><strong>Calificación Final y Podio:</strong> Se califica la final, se cierra la Ronda 2 y se publican 1º, 2º y 3º puesto.</div></div>
            <div class="flow-item"><span class="flow-num">5</span> <div><strong>Calificar la Ronda 1:</strong> Los jurados recorren los salones y registran las notas de cada póster.</div></div>
            <div class="flow-item"><span class="flow-num">10</span> <div><strong>Entrega de Certificados:</strong> Se descargan e imprimen los diplomas oficiales para los ganadores.</div></div>
          </div>
        </div>
      </div>

      <div class="cover-bottom">
        <div class="cover-meta">
          <p><strong>Programas Académicos:</strong> Ingeniería de Sistemas e Ingeniería Civil</p>
          <p><strong>Enlace en el Campus UCC:</strong> <code>http://172.42.0.130:5173/</code> (Conectado al Wi-Fi de la Universidad)</p>
        </div>
        <div style="text-align: right;">
          <img src="img/qr_app_posters.svg" style="width: 58px; height: 58px; background: #ffffff; padding: 4px; border-radius: 8px;" alt="QR URL">
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PÁGINA 2: FASE 1 ==================== -->
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-brand">
        <img src="img/logoucc.png" alt="UCC">
        <div class="doc-header-titles">
          <h4>GUÍA ILUSTRADA DE LAS 10 FASES DEL SISTEMA</h4>
          <p>Universidad Cooperativa de Colombia · Explicación Sencilla Paso a Paso</p>
        </div>
      </div>
      <div class="doc-header-tag">Fase 1 de 10 · Preparación</div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 1</span> Configurar los Salones, Criterios y Cupos de la Ronda 1</h2>

    <div class="plain-explanation">
      <strong>¿En qué consiste esta primera fase?</strong><br>
      Antes de invitar a los estudiantes y profesores a subir sus trabajos, el <strong>Administrador</strong> organiza las reglas del juego: define en qué salones o pasillos se colocarán los carteles físicos, qué puntos van a calificar los jurados y <strong>cuántos pósteres como máximo pasarán a la Gran Final</strong> (por ejemplo: "de todos los inscritos, solo los 10 mejores pasarán a la Ronda 2").
    </div>

    <div class="step-box">
      <div class="step-box-header">
        <span class="step-badge"> Acción 1.1</span>
        <span class="step-box-title">El Centro de Control del Administrador</span>
      </div>
      <p class="step-instruction">
        Cuando el Administrador entra al sistema, ve un panel muy intuitivo dividido por tarjetas. Nota importante: el <strong>Administrador de Civil</strong> solo ve lo de Ingeniería Civil, el <strong>Administrador de Sistemas</strong> solo ve lo de Ingeniería de Sistemas, y el <strong>Super Admin</strong> puede supervisar ambas carreras:
      </p>
      <div class="screenshot-frame">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Panel Principal del Administrador (http://172.42.0.130:5173/superadmin)</span>
        </div>
        <img class="screenshot-img" src="img/f1_panel_admin.png" alt="Panel del Administrador">
      </div>
    </div>

    <div class="step-box" style="margin-bottom:0;">
      <div class="step-box-header">
        <span class="step-badge">Acción 1.2</span>
        <span class="step-box-title">Crear los Espacios Físicos (Numeración Continua) y las Preguntas a Calificar</span>
      </div>
      <p class="step-instruction">
        El administrador registra los salones (ej. <em>Auditorio Bloque A</em> con capacidad para 8 pósteres, y <em>Sala de Innovación</em> con capacidad para 10). El sistema numera los puestos de corrido: del <strong>1 al 8</strong> en el primer salón y sigue con el <strong>9 al 18</strong> en el segundo salón. Al mismo tiempo, define los <strong>Criterios de Evaluación</strong> (las preguntas que calificarán los jurados):
      </p>
      <div class="two-col-grid">
        <div class="screenshot-frame" style="margin:0;">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Configuración de Salones y Capacidad</span>
          </div>
          <img class="screenshot-img" style="max-height:66mm;" src="img/f1_espacios_modal.png" alt="Espacios Físicos">
        </div>
        <div class="screenshot-frame" style="margin:0;">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Criterios que Calificarán los Jurados</span>
          </div>
          <img class="screenshot-img" style="max-height:66mm;" src="img/f1_criterios_modal.png" alt="Criterios de Evaluación">
        </div>
      </div>
      <div class="step-tip">
        💡 <strong>¿Todo es independiente por carrera?</strong> ¡Sí! Los salones, las rondas, los criterios y los premios de Ingeniería Civil están totalmente separados de los de Ingeniería de Sistemas para que nunca se mezclen.
      </div>
    </div>

    <div class="doc-footer">
      <span>Guía Ilustrada de las 10 Fases Operativas · Universidad Cooperativa de Colombia</span>
      <span>Página 2</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 3: FASE 2 ==================== -->
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-brand">
        <img src="img/logoucc.png" alt="UCC">
        <div class="doc-header-titles">
          <h4>GUÍA ILUSTRADA DE LAS 10 FASES DEL SISTEMA</h4>
          <p>Universidad Cooperativa de Colombia · Explicación Sencilla Paso a Paso</p>
        </div>
      </div>
      <div class="doc-header-tag">Fase 2 de 10 · Usuarios y Jurados</div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 2</span> Registro de Usuarios, Aprobación y Elección de Evaluadores</h2>

    <div class="plain-explanation">
      <strong>¿En qué consiste esta segunda fase?</strong><br>
      Los profesores y estudiantes entran a la página web y crean su cuenta. Para evitar que personas ajenas entren sin permiso, las cuentas nuevas quedan "en sala de espera" hasta que el Administrador las acepta con un clic. Una vez aceptados, el Administrador elige qué profesores tendrán el cargo de <strong>Evaluadores (Jurados)</strong> o <strong>Administradores</strong>.
    </div>

    <div class="two-col-grid" style="margin-bottom:8px;">
      <div class="step-box" style="margin:0;">
        <div class="step-box-header">
          <span class="step-badge">Paso 2.1</span>
          <span class="step-box-title">1. Los participantes se registran</span>
        </div>
        <p class="step-instruction">
          En la pantalla de inicio hacen clic en <strong>"Regístrate"</strong>, escriben su nombre, su correo de la universidad y eligen su carrera (<em>Sistemas</em> o <em>Civil</em>):
        </p>
        <div class="screenshot-frame">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Formulario de Registro</span>
          </div>
          <img class="screenshot-img" style="max-height:60mm;" src="img/02_registro_modal_zoom.png" alt="Formulario de Registro">
        </div>
      </div>

      <div class="step-box" style="margin:0;">
        <div class="step-box-header">
          <span class="step-badge">Paso 2.2</span>
          <span class="step-box-title">2. El Administrador aprueba la cuenta</span>
        </div>
        <p class="step-instruction">
          En la sección <strong>"Usuarios Pendientes por Aceptación"</strong>, el Administrador ve a los recién inscritos y presiona el botón verde <strong>"Aceptar"</strong>:
        </p>
        <div class="screenshot-frame">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Bandeja de Solicitudes Pendientes</span>
          </div>
          <img class="screenshot-img" style="max-height:60mm;" src="img/f2_solicitudes_pendientes.png" alt="Solicitudes Pendientes">
        </div>
      </div>
    </div>

    <div class="step-box" style="margin-bottom:0;">
      <div class="step-box-header">
        <span class="step-badge">Paso 2.3</span>
        <span class="step-box-title">3. Nombrar a los Profesores Evaluadores (Jurados) o Administradores</span>
      </div>
      <p class="step-instruction">
        Por defecto, toda persona entra como <em>Usuario (Autor)</em>. Para convertir a un docente en jurado calificador, el Administrador va a la tabla <strong>"Gestión de Usuarios"</strong>, busca al profesor y en la columna <strong>"Cambiar Rol"</strong> selecciona <strong>Evaluador</strong> (o <em>Admin Sistemas / Admin Civil</em> si desea darle permisos administrativos de su carrera):
      </p>
      <div class="screenshot-frame">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Tabla de Gestión de Usuarios y Asignación de Roles</span>
        </div>
        <img class="screenshot-img" style="max-height:74mm;" src="img/f2_usuarios_roles.png" alt="Gestión de Usuarios y Roles">
      </div>
      <div class="step-tip">
        🔒 <strong>Privacidad por carrera:</strong> El Administrador de Civil solo verá en esta lista a los estudiantes y profesores de Civil, y el de Sistemas solo a los de Sistemas.
      </div>
    </div>

    <div class="doc-footer">
      <span>Guía Ilustrada de las 10 Fases Operativas · Universidad Cooperativa de Colombia</span>
      <span>Página 3</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 4: FASE 3 ==================== -->
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-brand">
        <img src="img/logoucc.png" alt="UCC">
        <div class="doc-header-titles">
          <h4>GUÍA ILUSTRADA DE LAS 10 FASES DEL SISTEMA</h4>
          <p>Universidad Cooperativa de Colombia · Explicación Sencilla Paso a Paso</p>
        </div>
      </div>
      <div class="doc-header-tag">Fase 3 de 10 · Subida de Pósteres</div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 3</span> Subir los Pósteres, Puesto Físico Automático y Código QR</h2>

    <div class="plain-explanation">
      <strong>¿En qué consiste esta tercera fase?</strong><br>
      Los autores (profesores o estudiantes) entran con su cuenta y presionan el botón azul <strong>"Cargar Póster"</strong>. Llenan los datos de su proyecto, indican qué profesor orientó la materia y adjuntan su cartel en PDF o imagen. <strong>Al guardarlo, el sistema le asigna automáticamente el número de puesto físico donde debe exhibirse en el salón y le crea un Código QR único.</strong>
    </div>

    <div class="two-col-grid" style="margin-bottom:8px;">
      <div class="step-box" style="margin:0;">
        <div class="step-box-header">
          <span class="step-badge">Paso 3.1</span>
          <span class="step-box-title">Botón Azul "Cargar Póster"</span>
        </div>
        <p class="step-instruction">
          En el panel del docente o estudiante siempre está visible el botón azul institucional <strong>"Cargar Póster"</strong> para abrir el formulario de inscripción del trabajo:
        </p>
        <div class="screenshot-frame">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Panel del Autor (Botón Cargar Póster)</span>
          </div>
          <img class="screenshot-img" style="max-height:60mm;" src="img/04_panel_estudiante_zoom.png" alt="Panel Autor">
        </div>
      </div>

      <div class="step-box" style="margin:0;">
        <div class="step-box-header">
          <span class="step-badge">Paso 3.2</span>
          <span class="step-box-title">Llenar Datos y Profesor de la Materia</span>
        </div>
        <p class="step-instruction">
          Al elegir el <strong>Profesor y Materia</strong>, sí aparecen los docentes de todas las carreras por si el póster es un proyecto conjunto que cruza materias de Sistemas y Civil:
        </p>
        <div class="screenshot-frame">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Formulario de Carga de Póster</span>
          </div>
          <img class="screenshot-img" style="max-height:60mm;" src="img/06_formulario_diligenciado_zoom.png" alt="Formulario Póster">
        </div>
      </div>
    </div>

    <div class="step-box" style="margin-bottom:0;">
      <div class="step-box-header">
        <span class="step-badge">Paso 3.3</span>
        <span class="step-box-title">Ubicación Física Consecutiva Automática y Código QR para Celulares</span>
      </div>
      <p class="step-instruction">
        A medida que se suben pósteres, el sistema llena el primer salón (Puesto #1, #2, #3...) y cuando se llena, continúa automáticamente en el segundo salón sin reiniciar la cuenta. Además, genera un <strong>Código QR</strong> que cualquier asistente puede escanear para ver el póster en su celular:
      </p>
      <div class="two-col-grid">
        <div class="screenshot-frame" style="margin:0;">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Mapa de Ubicaciones Físicas Continuas</span>
          </div>
          <img class="screenshot-img" style="max-height:65mm;" src="img/f3_ubicaciones_continuas.png" alt="Ubicaciones Físicas">
        </div>
        <div class="screenshot-frame" style="margin:0;">
          <div class="screenshot-bar">
            <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
            <span class="bar-url">Ficha con Código QR Oficial del Póster</span>
          </div>
          <img class="screenshot-img" style="max-height:65mm;" src="img/07_modal_qr_zoom.png" alt="Código QR">
        </div>
      </div>
    </div>

    <div class="doc-footer">
      <span>Guía Ilustrada de las 10 Fases Operativas · Universidad Cooperativa de Colombia</span>
      <span>Página 4</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 5: FASES 4 Y 5 ==================== -->
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-brand">
        <img src="img/logoucc.png" alt="UCC">
        <div class="doc-header-titles">
          <h4>GUÍA ILUSTRADA DE LAS 10 FASES DEL SISTEMA</h4>
          <p>Universidad Cooperativa de Colombia · Explicación Sencilla Paso a Paso</p>
        </div>
      </div>
      <div class="doc-header-tag">Fases 4 y 5 · Jurados y Calificación R1</div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 4</span> Asignación de Jurados y Bloqueo de Conflicto de Intereses</h2>

    <div class="plain-explanation">
      <strong>¿Cómo garantiza el sistema que la calificación sea 100% justa e imparcial?</strong><br>
      En la Ronda 1 cada póster tiene un jurado evaluador. El sistema aplica automáticamente la regla de <strong>"Cero Conflicto de Intereses"</strong>:
      <strong>1)</strong> Un autor jamás puede calificarse su propio póster, y <strong>2)</strong> El profesor de la materia asociada al póster tampoco puede ser jurado de ese trabajo. Si el administrador desea cambiar o asignar manualmente un jurado, presiona <strong>"Ver más..."</strong> en Pósteres Publicados y hace clic en <strong>"👥 Asignar Evaluador"</strong>:
    </div>

    <div class="two-col-grid" style="margin-bottom:10px;">
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Tabla Completa de Pósteres (Botón "Ver más...")</span>
        </div>
        <img class="screenshot-img" style="max-height:62mm;" src="img/f4_tabla_admin_posters.png" alt="Tabla Admin Pósteres">
      </div>
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Ventana para Elegir o Cambiar el Jurado Evaluador</span>
        </div>
        <img class="screenshot-img" style="max-height:62mm;" src="img/f4_asignar_evaluador.png" alt="Asignar Evaluador">
      </div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 5</span> Calificación de los Pósteres en la Ronda 1 (Vista del Jurado)</h2>

    <div class="plain-explanation">
      <strong>¿Cómo califican los profesores Evaluadores el día del evento?</strong><br>
      Cada profesor Evaluador entra a su cuenta desde su celular o portátil. El sistema le avisa cuántos pósteres le faltan por calificar. Al bajar a la tabla, presiona el botón <strong>"⭐ Calificar"</strong>, coloca una nota de <strong>1.0 a 5.0</strong> en cada criterio y escribe sus comentarios. ¡El sistema calcula el promedio automáticamente!
    </div>

    <div class="two-col-grid">
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Tabla del Jurado con Pósteres Asignados</span>
        </div>
        <img class="screenshot-img" style="max-height:66mm;" src="img/f5_tabla_evaluador.png" alt="Tabla del Evaluador">
      </div>
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Formulario donde el Jurado Coloca las Notas (1.0 a 5.0)</span>
        </div>
        <img class="screenshot-img" style="max-height:66mm;" src="img/f5_modal_calificar.png" alt="Modal de Calificación">
      </div>
    </div>

    <div class="doc-footer">
      <span>Guía Ilustrada de las 10 Fases Operativas · Universidad Cooperativa de Colombia</span>
      <span>Página 5</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 6: FASES 6, 7 Y 8 ==================== -->
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-brand">
        <img src="img/logoucc.png" alt="UCC">
        <div class="doc-header-titles">
          <h4>GUÍA ILUSTRADA DE LAS 10 FASES DEL SISTEMA</h4>
          <p>Universidad Cooperativa de Colombia · Explicación Sencilla Paso a Paso</p>
        </div>
      </div>
      <div class="doc-header-tag">Fases 6, 7 y 8 · El Corte y Ronda 2</div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 6</span> Cerrar la Ronda 1 y Hacer el Corte de Clasificados</h2>

    <div class="plain-explanation">
      <strong>¿Qué pasa cuando todos los jurados terminan de calificar la Ronda 1?</strong><br>
      El Administrador entra a <strong>"Administrar Rondas y Premios"</strong> y abre el <strong>Ranking de la Ronda 1</strong>. Allí ve todos los pósteres ordenados del puntaje más alto al más bajo. Al hacer clic en <strong>"Cerrar ronda y pasar a la siguiente"</strong>, el sistema marca automáticamente a los mejores según la capacidad máxima configurada (por ejemplo, los 2 mejores promedios) y deja por fuera del corte a los demás.
    </div>

    <div class="two-col-grid" style="margin-bottom:10px;">
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Ranking de Ronda 1 Ordenado por Promedio</span>
        </div>
        <img class="screenshot-img" style="max-height:64mm;" src="img/f6_ranking_ronda1.png" alt="Ranking Ronda 1">
      </div>
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Confirmación del Corte: Pasan los Mejores a Ronda 2</span>
        </div>
        <img class="screenshot-img" style="max-height:64mm;" src="img/f6_modal_corte.png" alt="Modal Corte Ronda 1">
      </div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fases 7 y 8</span> Apertura de la Ronda 2 (Gran Final) y Nuevos Evaluadores</h2>

    <div class="plain-explanation">
      <strong>¿Cómo funciona la Segunda Ronda con los seleccionados?</strong><br>
      Al confirmar el cierre de la Ronda 1, ocurre la magia en dos pasos automáticos:<br>
      • <strong>Fase 7 (Apertura de Ronda 2):</strong> Se abre la <strong>Ronda 2 (Gran Final en Auditorio)</strong> donde <em>únicamente</em> participan los pósteres que superaron el corte.<br>
      • <strong>Fase 8 (Nuevos Jurados Imparciales):</strong> Se eligen nuevamente evaluadores para calificar a los finalistas. <strong>El sistema rota a los jurados</strong> para que ningún evaluador que ya calificó un póster en la Ronda 1 vuelva a calificar el mismo póster en la Ronda 2.
    </div>

    <div class="screenshot-frame">
      <div class="screenshot-bar">
        <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
        <span class="bar-url">Ronda 2 (Gran Final) Abierta Solo con los Clasificados y sus Nuevos Jurados Rotados</span>
      </div>
      <img class="screenshot-img" style="max-height:70mm;" src="img/f7_8_ronda2_final.png" alt="Ronda 2 Finalistas y Evaluadores">
    </div>

    <div class="doc-footer">
      <span>Guía Ilustrada de las 10 Fases Operativas · Universidad Cooperativa de Colombia</span>
      <span>Página 6</span>
    </div>
  </div>

  <!-- ==================== PÁGINA 7: FASES 9 Y 10 ==================== -->
  <div class="page">
    <div class="doc-header">
      <div class="doc-header-brand">
        <img src="img/logoucc.png" alt="UCC">
        <div class="doc-header-titles">
          <h4>GUÍA ILUSTRADA DE LAS 10 FASES DEL SISTEMA</h4>
          <p>Universidad Cooperativa de Colombia · Explicación Sencilla Paso a Paso</p>
        </div>
      </div>
      <div class="doc-header-tag">Fases 9 y 10 · Premiación y Diplomas</div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 9</span> Segunda Calificación, Cierre Final y Podio de Ganadores</h2>

    <div class="plain-explanation">
      <strong>¿Cómo se eligen los ganadores definitivos del evento?</strong><br>
      Los nuevos jurados califican la exposición final de los pósteres seleccionados en la Ronda 2. Una vez todos tienen su calificación final, el Administrador cierra la Ronda 2, presiona <strong>"Previsualizar podio"</strong> y el sistema le propone el <strong>1º Lugar, 2º Lugar y 3º Lugar</strong> según las notas más altas. Al hacer clic en <strong>"Publicar podio"</strong>, quedan proclamados los ganadores oficiales:
    </div>

    <div class="two-col-grid" style="margin-bottom:8px;">
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Paso 9.1: Previsualizar y Confirmar Puestos del Podio</span>
        </div>
        <img class="screenshot-img" style="max-height:56mm;" src="img/f9_previsualizar_podio.png" alt="Previsualizar Podio">
      </div>
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Paso 9.2: Podio Oficial Publicado con Botón de Certificado</span>
        </div>
        <img class="screenshot-img" style="max-height:56mm;" src="img/f9_podio_publicado.png" alt="Podio Publicado">
      </div>
    </div>

    <h2 class="section-title"><span class="section-title-badge">Fase 10</span> Generación y Entrega de Certificados a los Ganadores</h2>

    <div class="plain-explanation">
      <strong>¿Cómo se entregan los certificados oficiales a los que ganaron?</strong><br>
      Tan pronto se publica el podio, aparece el botón <strong>"📜 Certificado"</strong> al lado de cada ganador (tanto en el panel del Administrador como en el panel personal de los autores ganadores). Al hacer clic, el sistema genera de inmediato el <strong>Diploma Oficial de Reconocimiento de la Universidad Cooperativa de Colombia</strong> en tamaño horizontal, listo para imprimir en papel pergamino o guardar como archivo PDF:
    </div>

    <div class="two-col-grid">
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Ventana de Descarga de Certificados de Premio</span>
        </div>
        <img class="screenshot-img" style="max-height:66mm;" src="img/f10_modal_certificados.png" alt="Modal Certificados">
      </div>
      <div class="screenshot-frame" style="margin:0;">
        <div class="screenshot-bar">
          <span class="bar-dot bd-red"></span><span class="bar-dot bd-yellow"></span><span class="bar-dot bd-green"></span>
          <span class="bar-url">Diploma Oficial Generado para los Ganadores (PDF / Impresión)</span>
        </div>
        <img class="screenshot-img" style="max-height:66mm;" src="img/f10_diploma_oficial.png" alt="Diploma Oficial UCC">
      </div>
    </div>

    <div class="step-tip" style="margin-top:8px;">
      🎓 <strong>¡Fin del Ciclo Operativo!</strong> Además de los diplomas, el Administrador puede descargar en un clic el <strong>"📄 PDF Resumen"</strong> de la ronda y el <strong>"📋 Informe Detallado"</strong> con todas las notas individuales para el archivo oficial de la Facultad de Ingeniería.
    </div>

    <div class="doc-footer">
      <span>Guía Ilustrada de las 10 Fases Operativas · Universidad Cooperativa de Colombia</span>
      <span>Página 7</span>
    </div>
  </div>

</body>
</html>`;

fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.writeFileSync(HTML_PATH, htmlContent, 'utf8');
console.log('HTML escrito en:', HTML_PATH);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/jhank/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome',
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.goto('file://' + HTML_PATH, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.pdf({
      path: PDF_OUT_1,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });
    fs.copyFileSync(PDF_OUT_1, PDF_OUT_2);
    console.log('✔ PDF generado exitosamente en:');
    console.log('  1)', PDF_OUT_1);
    console.log('  2)', PDF_OUT_2);
  } finally {
    await browser.close();
  }
})();
