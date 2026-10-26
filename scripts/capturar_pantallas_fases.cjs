/**
 * scripts/capturar_pantallas_fases.js
 * Captura imágenes reales de alta resolución de todas las 10 fases del sistema
 * utilizando Playwright + Chromium sobre http://localhost:5173
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'guia-flujo', 'img');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Copiar imágenes base existentes de guia-registro
const REG_IMG_DIR = path.join(__dirname, '..', 'docs', 'guia-registro', 'img');
const archivosBase = [
  'logoucc.png',
  'qr_app_posters.svg',
  '01_hero_portal_zoom.png',
  '02_registro_modal_zoom.png',
  '03_inicio_sesion.png',
  '04_panel_estudiante_zoom.png',
  '06_formulario_diligenciado_zoom.png',
  '07_mis_posters_zoom.png',
  '07_modal_qr_zoom.png'
];
for (const f of archivosBase) {
  const src = path.join(REG_IMG_DIR, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT_DIR, f));
  }
}

function runPhpStage(stage) {
  const out = execSync(`php "${path.join(__dirname, 'escenario_capturas.php')}" ${stage}`, { encoding: 'utf8' });
  const jsonStart = out.indexOf('{');
  return jsonStart >= 0 ? JSON.parse(out.slice(jsonStart)) : {};
}

async function setSession(page, token, id, rol, nombre, carrera = 'Ingeniería de Sistemas') {
  await page.evaluate(({ token, id, rol, nombre, carrera }) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('idUsuario', String(id));
    localStorage.setItem('id_usuario', String(id));
    localStorage.setItem('id_rol', String(rol));
    localStorage.setItem('rol', rol === 4 ? 'superadmin' : rol === 3 ? 'admin' : rol === 2 ? 'evaluador' : 'usuario');
    localStorage.setItem('rolUsuario', rol === 4 ? 'superadmin' : rol === 3 ? 'admin' : rol === 2 ? 'evaluador' : 'usuario');
    localStorage.setItem('nombreUsuario', nombre);
    localStorage.setItem('carreraUsuario', carrera);
  }, { token, id, rol, nombre, carrera });
}

(async () => {
  console.log('1. Inicializando escenario de base de datos...');
  const initData = runPhpStage('init');
  const browser = await chromium.launch({
    executablePath: '/home/jhank/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome',
    headless: true
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1380, height: 860 },
      deviceScaleFactor: 1.5
    });
    const page = await context.newPage();

    // Autenticar como Super Admin
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await setSession(page, initData.tokenSuperAdmin, 1, 4, 'Camilo Andrés Moncaleano Murillo');
    await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // FASE 1A: Panel General del Super Admin
    console.log('Capturando Fase 1: Panel Admin...');
    await page.screenshot({ path: path.join(OUT_DIR, 'f1_panel_admin.png') });

    // FASE 1B: Espacios Físicos y Numeración Continua
    console.log('Capturando Fase 1: Espacios Físicos...');
    const secEspacios = page.locator('#espacios');
    await secEspacios.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await secEspacios.locator('button.boton-primario').click();
    await page.waitForTimeout(600);
    const modalEspacios = page.locator('.modal-espacios-contenido').first();
    await modalEspacios.screenshot({ path: path.join(OUT_DIR, 'f1_espacios_modal.png') });
    await page.locator('.cerrar-modal').first().click();
    await page.waitForTimeout(300);

    // FASE 1C: Criterios de Evaluación
    console.log('Capturando Fase 1: Criterios de Evaluación...');
    const secCriterios = page.locator('#criterios');
    await secCriterios.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await secCriterios.locator('button.boton-primario').click();
    await page.waitForTimeout(600);
    const modalCriterios = page.locator('.modal .formularios').first();
    await modalCriterios.screenshot({ path: path.join(OUT_DIR, 'f1_criterios_modal.png') });
    await page.locator('.modal .cerrar-formulario').first().click();
    await page.waitForTimeout(300);

    // FASE 2A: Solicitudes Pendientes de Aprobación
    console.log('Capturando Fase 2: Solicitudes Pendientes...');
    const secPendientes = page.locator('#pendientes').first();
    await secPendientes.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await secPendientes.screenshot({ path: path.join(OUT_DIR, 'f2_solicitudes_pendientes.png') });

    // FASE 2B: Gestión de Usuarios y Cambio de Rol a Evaluador / Admin
    console.log('Capturando Fase 2: Gestión de Usuarios y Roles...');
    const secUsuarios = page.locator('#usuarios').first();
    await secUsuarios.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const verMasUsr = secUsuarios.locator('a.ver-mas').first();
    if (await verMasUsr.count() > 0) {
      await verMasUsr.click();
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const mod = document.querySelector('.modal section, .modal > div');
        if (mod) {
          mod.style.maxWidth = '1320px';
          mod.style.width = '96vw';
        }
      });
      await page.waitForTimeout(200);
      const modalUsr = page.locator('.modal section, .modal > div').first();
      await modalUsr.screenshot({ path: path.join(OUT_DIR, 'f2_usuarios_roles.png') });
      await page.locator('.modal .cerrar-tabla, .modal .cerrar-formulario').first().click();
      await page.waitForTimeout(300);
    } else {
      await secUsuarios.screenshot({ path: path.join(OUT_DIR, 'f2_usuarios_roles.png') });
    }

    // FASE 3: Listado Completo por Ubicaciones Físicas (Numeración Continua)
    console.log('Capturando Fase 3: Listado Completo por Ubicaciones...');
    await secEspacios.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await secEspacios.locator('button.boton-secundario').first().click();
    await page.waitForTimeout(700);
    const modalUbic = page.locator('.listado-ubicaciones-print').first();
    await modalUbic.screenshot({ path: path.join(OUT_DIR, 'f3_ubicaciones_continuas.png') });
    await page.locator('.listado-ubicaciones-print .cerrar-tabla').first().click();
    await page.waitForTimeout(300);

    // FASE 4: Pósters Publicados -> Ver más -> Asignar Evaluador (Control de Conflicto de Intereses)
    console.log('Capturando Fase 4: Asignación de Evaluador y Conflicto de Intereses...');
    const secPosters = page.locator('#posters').first();
    await secPosters.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const btnAsignar = secPosters.locator('button.btn-asignar').first();
    if (await btnAsignar.count() > 0) {
      await btnAsignar.click();
      await page.waitForTimeout(700);
      const modalAsig = page.locator('.modal-contenido-evaluador').first();
      await modalAsig.screenshot({ path: path.join(OUT_DIR, 'f4_asignar_evaluador.png') });
      await page.locator('.modal-contenido-evaluador .btn-cerrar').first().click();
      await page.waitForTimeout(300);
    }

    // También capturar la vista completa de MostrarPostersAdmin al darle "Ver más..."
    const verMasPosters = secPosters.locator('a.ver-mas').first();
    if (await verMasPosters.count() > 0) {
      await verMasPosters.click();
      await page.waitForTimeout(700);
      const modalPostersAdmin = page.locator('.modal .todos-posters').first();
      await modalPostersAdmin.screenshot({ path: path.join(OUT_DIR, 'f4_tabla_admin_posters.png') });
      await page.locator('.modal .cerrar-tabla').first().click();
      await page.waitForTimeout(300);
    }

    // FASE 5: Vista del Jurado Evaluador y Calificación por Criterios
    console.log('Capturando Fase 5: Panel del Evaluador y Calificación...');
    await setSession(page, initData.tokenEvaluador, 46, 2, 'Laura Gómez Ríos');
    await page.goto('http://localhost:5173/evaluador', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT_DIR, 'f5_panel_evaluador_hero.png') });

    const secPostersEval = page.locator('#posters').first();
    await secPostersEval.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await secPostersEval.screenshot({ path: path.join(OUT_DIR, 'f5_tabla_evaluador.png') });

    // Abrir Modal de Calificación
    const btnCalificar = secPostersEval.locator('button:has-text("Calificar"), button:has-text("Editar")').first();
    if (await btnCalificar.count() > 0) {
      await btnCalificar.click();
      await page.waitForTimeout(600);
      const modalEval = page.locator('.modal-contenido-evaluar').first();
      await modalEval.screenshot({ path: path.join(OUT_DIR, 'f5_modal_calificar.png') });
      await page.locator('.modal-contenido-evaluar .btn-cerrar, .modal-contenido-evaluar button:has-text("Cancelar")').first().click();
      await page.waitForTimeout(300);
    }

    // Completar todas las calificaciones de Ronda 1 para el corte
    runPhpStage('completar_ronda1');

    // FASE 6: Cierre de Ronda 1 y Corte Automático de Clasificados
    console.log('Capturando Fase 6: Ranking Ronda 1 y Corte de Clasificados...');
    await setSession(page, initData.tokenSuperAdmin, 1, 4, 'Camilo Andrés Moncaleano Murillo');
    await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const secRondas = page.locator('#rondas').first();
    await secRondas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await secRondas.locator('button:has-text("Administrar Rondas y Premios")').first().click();
    await page.waitForTimeout(800);

    const modalRondas = page.locator('.formularios-rondas').first();
    // Abrir ranking de Ronda 1
    const tarjetaR1 = modalRondas.locator('.tarjeta-ronda').first();
    await tarjetaR1.locator('button:has-text("Ver ranking")').first().click();
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      document.querySelectorAll('header, nav, .volver-arriba').forEach(el => {
        if (!el.classList.contains('ronda-cabecera') && !el.classList.contains('modal-header')) {
          el.style.display = 'none';
        }
      });
      const m = document.querySelector('.modal');
      const f = document.querySelector('.formularios-rondas');
      if (m) { m.style.position = 'static'; m.style.height = 'auto'; m.style.overflow = 'visible'; }
      if (f) { f.style.maxHeight = 'none'; f.style.overflow = 'visible'; }
    });
    await page.waitForTimeout(200);
    await tarjetaR1.screenshot({ path: path.join(OUT_DIR, 'f6_ranking_ronda1.png') });

    // Abrir modal "Cerrar ronda y pasar a la siguiente"
    await tarjetaR1.locator('button:has-text("Cerrar ronda y pasar a la siguiente")').first().click();
    await page.waitForTimeout(800);
    const modalCorte = page.locator('.modal .formularios').last();
    await modalCorte.screenshot({ path: path.join(OUT_DIR, 'f6_modal_corte.png') });

    // FASE 7 y 8: Ronda 2 (Gran Final) Abierta con Clasificados y Rotación de Evaluadores
    console.log('Capturando Fase 7 y 8: Ronda 2 (Gran Final) y Nuevos Evaluadores...');
    runPhpStage('fase_ronda2');
    await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.locator('#rondas').first().scrollIntoViewIfNeeded();
    await page.locator('#rondas button:has-text("Administrar Rondas y Premios")').first().click();
    await page.waitForTimeout(800);

    const tarjetaR2 = page.locator('.formularios-rondas .tarjeta-ronda').nth(1);
    await tarjetaR2.locator('button:has-text("Ver ranking")').first().click();
    await page.waitForTimeout(600);
    await tarjetaR2.locator('button:has-text("Evaluadores")').first().click();
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.querySelectorAll('header, nav, .volver-arriba').forEach(el => {
        if (!el.classList.contains('ronda-cabecera') && !el.classList.contains('modal-header')) {
          el.style.display = 'none';
        }
      });
      const m = document.querySelector('.modal');
      const f = document.querySelector('.formularios-rondas');
      if (m) { m.style.position = 'static'; m.style.height = 'auto'; m.style.overflow = 'visible'; }
      if (f) { f.style.maxHeight = 'none'; f.style.overflow = 'visible'; }
    });
    await page.waitForTimeout(200);
    await tarjetaR2.screenshot({ path: path.join(OUT_DIR, 'f7_8_ronda2_final.png') });

    // FASE 9A: Previsualización del Podio de Ganadores
    console.log('Capturando Fase 9: Previsualización y Publicación del Podio...');
    const btnPrevPodio = tarjetaR2.locator('button:has-text("Previsualizar podio")').first();
    await btnPrevPodio.scrollIntoViewIfNeeded();
    await btnPrevPodio.click();
    await page.waitForTimeout(700);
    const seccionPodio = tarjetaR2.locator('.podio-seccion').first();
    await seccionPodio.screenshot({ path: path.join(OUT_DIR, 'f9_previsualizar_podio.png') });

    // FASE 9B: Podio Publicado Oficialmente
    runPhpStage('fase_podio');
    await page.goto('http://localhost:5173/superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.locator('#rondas').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // Capturar tabla resumen de rondas en el Home mostrando los ganadores publicados
    await page.locator('#rondas').first().screenshot({ path: path.join(OUT_DIR, 'f9_resumen_ganadores_home.png') });

    await page.locator('#rondas button:has-text("Administrar Rondas y Premios")').first().click();
    await page.waitForTimeout(800);
    const tarjetaR2Cerrada = page.locator('.formularios-rondas .tarjeta-ronda').nth(1);
    await tarjetaR2Cerrada.locator('button:has-text("Ver ranking")').first().click();
    await page.waitForTimeout(700);
    await tarjetaR2Cerrada.locator('.podio-seccion').first().scrollIntoViewIfNeeded();
    await tarjetaR2Cerrada.locator('.podio-seccion').first().screenshot({ path: path.join(OUT_DIR, 'f9_podio_publicado.png') });

    // FASE 10: Modal de Certificados y Diploma Oficial
    console.log('Capturando Fase 10: Certificados y Diploma Oficial...');
    await tarjetaR2Cerrada.locator('button:has-text("Descargar todos los certificados")').first().click();
    await page.waitForTimeout(600);
    const modalCert = page.locator('.modal .formularios').last();
    await modalCert.screenshot({ path: path.join(OUT_DIR, 'f10_modal_certificados.png') });

    // Capturar el Diploma Oficial renderizado en una pestaña dedicada
    const certPage = await context.newPage();
    await certPage.setViewportSize({ width: 1120, height: 790 });
    await certPage.setContent(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 16px; background: #eef2f5; font-family: Georgia, 'Times New Roman', serif; color: #132740; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .certificado {
              width: 1040px; height: 730px; background: #ffffff;
              border: 6px solid #132740; border-radius: 10px;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              padding: 40px 60px; text-align: center; position: relative; overflow: hidden;
              box-shadow: 0 12px 32px rgba(19,39,64,0.18);
          }
          .certificado::before {
              content: ''; position: absolute; inset: 10px; border: 2px solid #00acc9; border-radius: 6px; pointer-events: none;
          }
          .certificado .logo { width: 96px; height: auto; margin-bottom: 10px; }
          .certificado .institucion { color: #5f5e5e; letter-spacing: 3px; text-transform: uppercase; font-size: 13px; font-family: system-ui, sans-serif; font-weight: 600; }
          .certificado h1 { font-size: 54px; margin: 8px 0 4px; color: #132740; letter-spacing: 2px; }
          .certificado .linea { width: 130px; height: 4px; background: #cad400; margin: 8px auto 20px; border-radius: 999px; }
          .certificado .otorgado { color: #5f5e5e; font-size: 18px; font-style: italic; margin: 0 0 8px; }
          .certificado .autor { font-size: 34px; color: #00acc9; margin: 4px 0 14px; font-weight: 700; }
          .certificado .detalle { font-size: 19px; color: #5f5e5e; line-height: 1.65; max-width: 780px; margin: 0 auto; }
          .certificado .detalle strong { color: #132740; }
          .certificado .premio {
              display: inline-block; margin: 18px 0 8px; padding: 10px 28px; border-radius: 999px;
              background: rgba(202, 212, 0, 0.22); border: 2px solid #cad400; color: #132740;
              font-family: system-ui, sans-serif; font-size: 22px; font-weight: 800;
          }
          .certificado .pie { margin-top: 20px; color: #5f5e5e; font-family: system-ui, sans-serif; font-size: 13px; }
          .certificado .firma { margin-top: 28px; width: 240px; border-top: 2px solid #132740; padding-top: 6px; font-family: system-ui, sans-serif; font-size: 13px; color: #132740; font-weight: 600; }
        </style>
      </head>
      <body>
        <section class="certificado">
          <img class="logo" src="http://localhost:5173/img/logoucc.png" alt="UCC" />
          <div class="institucion">Universidad Cooperativa de Colombia · Facultad de Ingeniería</div>
          <h1>Certificado</h1>
          <div class="linea"></div>
          <p class="otorgado">Se certifica que</p>
          <p class="autor">Sofía Herrera, Mateo Rivas</p>
          <p class="detalle">
            han obtenido un reconocimiento especial en el evento <strong>Semestre B 2026 - Ingeniería de Sistemas</strong>
            (2026-B-SIS) con el póster de investigación
            <strong>«Detección temprana de intrusiones en redes del campus»</strong>.
          </p>
          <div class="premio">🏆 1º Lugar — Mejor Póster del Evento</div>
          <div class="pie">Expedido en Ibagué, Colombia · Código del evento: 2026-B-SIS</div>
          <div class="firma">Coordinación Académica del Evento</div>
        </section>
      </body>
      </html>
    `, { waitUntil: 'networkidle' });
    await certPage.waitForTimeout(400);
    await certPage.locator('.certificado').screenshot({ path: path.join(OUT_DIR, 'f10_diploma_oficial.png') });

    console.log('✔ Todas las capturas fueron generadas exitosamente en:', OUT_DIR);
  } finally {
    await browser.close();
    console.log('Restaurando estado original de la base de datos...');
    runPhpStage('cleanup');
    console.log('✔ Base de datos limpia.');
  }
})();
