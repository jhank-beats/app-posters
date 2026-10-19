// InformeCalificacionesPDF — informe detallado de una ronda con las notas
// INDIVIDUALES de cada evaluador por póster y el promedio entre todos
// (mejora 2026-10). Mismo patrón que CertificadoPremio/ResumenRondaPDF:
// ventana nueva + document.write + window.print(). Sin jsPDF (prohibido por
// la especificación del proyecto).

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
    .cabecera h1 { margin: 4px 0; font-size: 21px; }
    .cabecera p { margin: 2px 0; color: #5f5e5e; font-size: 13px; }
    .poster { border: 1px solid #d5ddd3; border-left: 5px solid #00acc9; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
    .poster h2 { margin: 0 0 2px; font-size: 15px; }
    .poster .meta { color: #5f5e5e; font-size: 12px; margin-bottom: 8px; }
    .promedio { display: inline-block; background: #132740; color: #fff; font-weight: 700; padding: 4px 10px; border-radius: 6px; font-size: 13px; margin-bottom: 8px; }
    .promedio.parcial { background: #b26a00; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d5ddd3; padding: 6px 8px; text-align: left; }
    th { background: #eef2f5; }
    td.nota { text-align: center; font-weight: 700; width: 70px; }
    td.pendiente { text-align: center; color: #b26a00; font-style: italic; width: 70px; }
    .pie { margin-top: 14px; color: #5f5e5e; font-size: 11px; text-align: center; }
    .resumen-final { margin-top: 6px; font-size: 12px; color: #5f5e5e; }
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

export const imprimirInformeRonda = (informe, { autoPrint = true } = {}) => {
    const ronda = informe?.ronda || {};
    const posters = informe?.posters || [];

    const bloques = posters.map((p) => {
        const evaluadores = p.evaluadores || [];
        const filas = evaluadores.length === 0
            ? `<tr><td colspan="3" style="text-align:center; color:#5f5e5e;">Sin evaluadores asignados a este póster.</td></tr>`
            : evaluadores.map(e => `
                <tr>
                    <td>${escaparHtml(e.nombre_evaluador)}</td>
                    <td class="${e.califico ? 'nota' : 'pendiente'}">${e.califico ? e.nota : 'pendiente'}</td>
                    <td>${escaparHtml(e.observaciones || '—')}</td>
                </tr>`).join('');

        const parcial = p.n_asignados > 0 && p.n_evaluaciones < p.n_asignados;
        return `
            <div class="poster">
                <h2>${escaparHtml(p.titulo)}</h2>
                <div class="meta">
                    <strong>Categoría:</strong> ${escaparHtml(p.categoria || '—')} ·
                    <strong>Autor:</strong> ${escaparHtml(p.nombre_autor || '—')} (${escaparHtml(p.autores || '—')})
                    ${p.seleccionado ? ' · <strong>✓ Pasó de ronda</strong>' : ''}
                </div>
                <div class="promedio ${parcial ? 'parcial' : ''}">
                    Promedio entre evaluadores: ${p.promedio ?? '—'}
                    &nbsp;(${p.n_evaluaciones} de ${p.n_asignados} evaluadores${parcial ? ' · parcial' : ''})
                </div>
                <table>
                    <thead><tr><th>Evaluador</th><th>Nota</th><th>Observaciones</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>`;
    }).join('');

    const totalPosters = posters.length;
    const conNota = posters.filter(p => p.n_evaluaciones > 0).length;
    const pasaron = posters.filter(p => p.seleccionado).length;

    const win = window.open('', '_blank', 'width=1000,height=760');
    if (!win) {
        alert('Debes permitir las ventanas emergentes para descargar el PDF.');
        return;
    }

    win.document.write(`<!DOCTYPE html>
        <html lang="es">
        <head><meta charset="utf-8" /><title>${escaparHtml('Informe de calificaciones · ' + (ronda.nombre || ''))}</title><style>${estilos}</style></head>
        <body>
            <div class="barra no-print">
                <strong>Informe de calificaciones (notas individuales)</strong>
                <button type="button" onclick="window.print()">📥 Descargar PDF</button>
                <button type="button" class="secundario" onclick="window.close()">Cerrar</button>
            </div>
            <div class="hoja">
                <div class="cabecera">
                    <div class="uni">Universidad Cooperativa de Colombia</div>
                    <h1>Informe de calificaciones · ${escaparHtml(ronda.nombre || '')}</h1>
                    <p>Evento: <strong>${escaparHtml(ronda.nombre_evento || '')}</strong> ${ronda.codigo_evento ? `(${escaparHtml(ronda.codigo_evento)})` : ''}</p>
                    <p>
                        Estado: <strong>${escaparHtml(ronda.estado || '—')}</strong>
                        ${ronda.fecha_inicio ? ` · Inicio: ${escaparHtml(ronda.fecha_inicio)}` : ''}
                        ${ronda.fecha_cierre ? ` · Cierre: ${escaparHtml(ronda.fecha_cierre)}` : ' · Sin fecha de cierre'}
                    </p>
                    <p class="resumen-final">
                        Pósters: ${totalPosters} · Con al menos una evaluación: ${conNota}
                        ${pasaron > 0 ? ` · Pasaron a la siguiente ronda: ${pasaron}` : ''}
                    </p>
                </div>
                ${bloques || '<p>Sin pósters en esta ronda.</p>'}
                <div class="pie">Generado el ${fechaHoy()} · Cada nota corresponde al promedio de los criterios de ese evaluador; el promedio del póster es la media de sus evaluadores.</div>
            </div>
        </body>
        </html>`);
    win.document.close();
    win.focus();
    if (autoPrint) setTimeout(() => win.print(), 350);
    return win;
};

const SERVER_URL = `http://${window.location.hostname}:8000`;

export const descargarInformeRondaPDF = async (idRonda) => {
    const res = await fetch(`${SERVER_URL}/api/Rondas.php?action=informe_ronda&id_ronda=${idRonda}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'No fue posible cargar el informe.');
    imprimirInformeRonda(data.data);
};
