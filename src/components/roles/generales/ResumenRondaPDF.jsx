// ResumenRondaPDF — PDF del resumen de ronda con window.print() (Fase 1.6).
// Mismo patrón que CertificadoPremio.jsx: ventana nueva + document.write +
// window.print(). No usa jsPDF (prohibido por la especificación).

import { API_BASE } from '../../../config.js';
import { categoriaLegible } from '../../../categorias.js';
const escaparHtml = (valor) => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const fechaHoy = () => {
    const f = new Date();
    return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
};

const estilos = `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #132740; background: #eef2f5; }
    .hoja { max-width: 210mm; margin: 0 auto; background: #fff; padding: 14mm 12mm; }
    .cabecera { border-bottom: 4px solid #00acc9; padding-bottom: 10px; margin-bottom: 14px; }
    .cabecera .uni { color: #5f5e5e; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }
    .cabecera h1 { margin: 4px 0; font-size: 22px; }
    .cabecera p { margin: 2px 0; color: #5f5e5e; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { border: 1px solid #d5ddd3; padding: 7px 8px; text-align: left; }
    th { background: #132740; color: #fff; }
    tr.pasa { background: rgba(202, 212, 0, 0.15); }
    .pie { margin-top: 14px; color: #5f5e5e; font-size: 11px; text-align: center; }
    .barra { position: sticky; top: 0; z-index: 5; background: #132740; color: #fff; display: flex; gap: 12px; justify-content: center; align-items: center; padding: 12px 16px; }
    .barra button { min-height: 40px; padding: 8px 18px; border-radius: 10px; border: 2px solid #00acc9; background: #00acc9; color: #fff; font-weight: 700; cursor: pointer; }
    .barra button.secundario { background: transparent; border-color: rgba(255,255,255,0.5); }
    @media print {
        body { background: #fff; }
        .hoja { max-width: none; margin: 0; padding: 0; }
        .no-print { display: none !important; }
    }
    @page { size: A4; margin: 12mm; }
`;

export const imprimirResumenRonda = (resumen, { autoPrint = true } = {}) => {
    const ronda = resumen?.ronda || {};
    const posters = resumen?.posters || [];
    const win = window.open('', '_blank', 'width=1000,height=760');
    if (!win) {
        alert('Debes permitir las ventanas emergentes para descargar el PDF.');
        return;
    }
    const filas = posters.map((p, i) => `
        <tr class="${p.pasa ? 'pasa' : ''}">
            <td>${i + 1}</td>
            <td><strong>${escaparHtml(p.titulo)}</strong><br/><small>${escaparHtml(p.autores || '')}</small></td>
            <td>${escaparHtml(categoriaLegible(p.categoria) || '—')}</td>
            <td>${p.promedio ?? '—'}</td>
            <td>${p.n_evaluaciones ?? 0}</td>
            <td>${p.pasa ? '✅ Pasa' : '—'}</td>
        </tr>`).join('');
    const pasaron = posters.filter(p => p.pasa).length;
    // En la última ronda no hay siguiente: no pasa nadie, se premia en el podio.
    const notaCorte = pasaron > 0
        ? `Pasaron: ${pasaron}`
        : (Number(ronda.corte_confirmado || 0) === 1
            ? 'Corte confirmado sin pósters seleccionados'
            : 'Ronda final · los resultados se premian en el podio');

    win.document.write(`<!DOCTYPE html>
        <html lang="es">
        <head><meta charset="utf-8" /><title>${escaparHtml('Resumen ' + (ronda.nombre || ''))}</title><style>${estilos}</style></head>
        <body>
            <div class="barra no-print">
                <strong>Resumen de ronda</strong>
                <button type="button" onclick="window.print()">📥 Descargar PDF</button>
                <button type="button" class="secundario" onclick="window.close()">Cerrar</button>
            </div>
            <div class="hoja">
                <div class="cabecera">
                    <div class="uni">Universidad Cooperativa de Colombia</div>
                    <h1>Resumen · ${escaparHtml(ronda.nombre || '')}</h1>
                    <p>Evento: <strong>${escaparHtml(ronda.nombre_evento || '')}</strong> ${ronda.codigo_evento ? `(${escaparHtml(ronda.codigo_evento)})` : ''}</p>
                    <p>Fecha de cierre: ${escaparHtml(ronda.fecha_cierre || '—')} · Pósters: ${posters.length} · ${notaCorte}</p>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Póster</th><th>Categoría</th><th>Promedio</th><th>Evaluaciones</th><th>Pasa</th></tr></thead>
                    <tbody>${filas || '<tr><td colspan="6">Sin pósters.</td></tr>'}</tbody>
                </table>
                <div class="pie">Generado el ${fechaHoy()} · Sistema de Gestión de Pósteres — GensTI</div>
            </div>
        </body>
        </html>`);
    win.document.close();
    win.focus();
    if (autoPrint) setTimeout(() => win.print(), 350);
    return win;
};


export const descargarResumenRondaPDF = async (idRonda) => {
    const res = await fetch(`${API_BASE}/Rondas.php?action=resumen_ronda&id_ronda=${idRonda}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'No fue posible cargar el resumen.');
    imprimirResumenRonda(data.data);
};
