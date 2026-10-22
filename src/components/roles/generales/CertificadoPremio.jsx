import React, { useState } from 'react';
import './roles.css';

// Certificado de premio — se genera en el frontend (sin dependencias nuevas)
// abriendo una ventana nueva con el mismo patrón de impresión que
// ListadoUbicaciones.jsx. Todo el contenido de usuario se ESCAPA antes de
// escribirlo en el HTML de la ventana (§8.5 del documento de especificación).

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

const URL_LOGO = `${window.location.origin}/img/logoucc.png`;

const estilosCertificado = `
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f5; font-family: Georgia, 'Times New Roman', serif; color: #132740; }
    .hoja { background: #eef2f5; padding: 12px 0; }
    .certificado {
        width: 277mm; height: 196mm; margin: 0 auto 12px; background: #ffffff;
        border: 6px solid #132740; border-radius: 10px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 14mm 18mm; text-align: center; position: relative; overflow: hidden;
    }
    .certificado::before {
        content: ''; position: absolute; inset: 8px; border: 2px solid #00acc9; border-radius: 6px; pointer-events: none;
    }
    .certificado .logo { width: 92px; height: auto; margin-bottom: 8px; }
    .certificado .institucion { color: #5f5e5e; letter-spacing: 3px; text-transform: uppercase; font-size: 12px; font-family: system-ui, sans-serif; }
    .certificado h1 { font-size: 52px; margin: 6px 0 2px; color: #132740; letter-spacing: 2px; }
    .certificado .linea { width: 120px; height: 4px; background: #cad400; margin: 6px auto 18px; border-radius: 999px; }
    .certificado .otorgado { color: #5f5e5e; font-size: 17px; font-style: italic; margin: 0 0 6px; }
    .certificado .autor { font-size: 34px; color: #00acc9; margin: 4px 0 12px; font-weight: 700; }
    /* Con varios autores el nombre es largo: se ajusta el tamaño para que
       quepa en la hoja sin romper el diseño. */
    .certificado .autor.autores-medios { font-size: 28px; }
    .certificado .autor.autores-largos { font-size: 21px; line-height: 1.3; margin-bottom: 8px; }
    .certificado .detalle { font-size: 18px; color: #5f5e5e; line-height: 1.7; max-width: 210mm; margin: 0 auto; }
    .certificado .detalle strong { color: #132740; }
    .certificado .premio {
        display: inline-block; margin: 14px 0 6px; padding: 10px 26px; border-radius: 999px;
        background: rgba(202, 212, 0, 0.18); border: 2px solid #cad400; color: #132740;
        font-family: system-ui, sans-serif; font-size: 22px; font-weight: 800;
    }
    .certificado .pie { margin-top: 18px; color: #5f5e5e; font-family: system-ui, sans-serif; font-size: 13px; }
    .certificado .firma { margin-top: 10px; width: 62mm; border-top: 2px solid #132740; padding-top: 6px; font-family: system-ui, sans-serif; font-size: 12px; color: #132740; }
    @media print {
        body { background: #fff; }
        .hoja { padding: 0; }
        .certificado { width: 277mm; height: 196mm; margin: 0; border-radius: 0; break-after: page; page-break-after: always; }
        .certificado:last-child { break-after: auto; page-break-after: auto; }
        .no-print { display: none !important; }
    }
    @page { size: A4 landscape; margin: 0; }
`;

const barraBotones = `
    .barra-certificado {
        position: sticky; top: 0; z-index: 5; background: #132740; color: #fff;
        display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;
        padding: 12px 16px; font-family: system-ui, sans-serif;
    }
    .barra-certificado button {
        min-height: 40px; padding: 8px 18px; border-radius: 10px; border: 2px solid #00acc9;
        background: #00acc9; color: #fff; font-weight: 700; cursor: pointer; font-size: 0.92rem;
    }
    .barra-certificado button.secundario { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
    .barra-certificado button:hover { background: #0093ad; }
`;

const construirCertificado = (ganador, evento) => {
    const titulo = escaparHtml(ganador.titulo);
    // Se certifica a los AUTORES del póster (campo `autores`). Solo si no
    // viniera se usa quien lo subió, como respaldo.
    const nombresAutores = String(ganador.autores || '').trim()
        || String(ganador.nombre_autor || '').trim()
        || 'Autor del póster';
    const autor = escaparHtml(nombresAutores);
    // Con varios autores el nombre es largo: se reduce el tamaño para que
    // quepa en la hoja sin romper el diseño.
    const claseAutor = nombresAutores.length > 60
        ? 'autor autores-largos'
        : (nombresAutores.length > 38 ? 'autor autores-medios' : 'autor');
    const lugarTexto = escaparHtml(ganador.premio || `${ganador.lugar}º lugar`);
    const nombreEvento = escaparHtml(evento?.nombre_evento || 'Evento institucional');
    const codigoEvento = escaparHtml(evento?.codigo_evento || '');
    return `
        <section class="certificado">
            <img class="logo" src="${URL_LOGO}" alt="Universidad Cooperativa de Colombia" />
            <div class="institucion">Universidad Cooperativa de Colombia</div>
            <h1>Certificado</h1>
            <div class="linea"></div>
            <p class="otorgado">Se certifica que</p>
            <p class="${claseAutor}">${autor}</p>
            <p class="detalle">
                ha obtenido un reconocimiento en el evento <strong>${nombreEvento}</strong>
                ${codigoEvento ? `(${codigoEvento})` : ''} con el póster
                <strong>«${titulo}»</strong>.
            </p>
            <div class="premio">🏆 ${lugarTexto}</div>
            <div class="pie">Expedido el ${fechaHoy()}${codigoEvento ? ` · Código del evento: ${codigoEvento}` : ''}</div>
            <div class="firma">Coordinación del evento</div>
        </section>
    `;
};

// Abre la ventana con uno o varios certificados y dispara la impresión.
// Se exporta para reutilizarla en la vista del autor (su diploma).
// eslint-disable-next-line react-refresh/only-export-components
export const imprimirCertificados = (ganadores, evento, { autoPrint = true, titulo = 'Certificado' } = {}) => {
    const lista = Array.isArray(ganadores) ? ganadores : [ganadores];
    const win = window.open('', '_blank', 'width=1100,height=760');
    if (!win) {
        alert('Debes permitir las ventanas emergentes para descargar el certificado.');
        return;
    }
    const cuerpo = lista.map(g => construirCertificado(g, evento)).join('');
    win.document.write(`<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8" />
            <title>${escaparHtml(titulo)}</title>
            <style>${estilosCertificado}${barraBotones}</style>
        </head>
        <body>
            <div class="barra-certificado no-print">
                <strong>${escaparHtml(lista.length > 1 ? `${lista.length} certificados` : 'Certificado de premio')}</strong>
                <button type="button" onclick="window.print()">📥 Descargar certificado</button>
                <button type="button" onclick="window.print()">🖨️ Imprimir</button>
                <button type="button" class="secundario" onclick="window.close()">Cerrar</button>
            </div>
            <div class="hoja">${cuerpo}</div>
        </body>
        </html>`);
    win.document.close();
    win.focus();
    if (autoPrint) {
        setTimeout(() => { win.print(); }, 350);
    }
    return win;
};

/**
 * Modal con la lista de ganadores y los botones de certificado.
 * ganadores: [{ id_poster, titulo, autores, nombre_autor, lugar, premio }]
 * evento: { nombre_evento, codigo_evento }
 */
const CertificadoPremio = ({ ganadores = [], evento = null, cerrarModal }) => {
    const [mensaje, setMensaje] = useState(null);

    const abrirUno = (ganador) => {
        setMensaje(null);
        imprimirCertificados(ganador, evento, { titulo: `Certificado - ${ganador.premio || ''}` });
    };

    const abrirTodos = () => {
        setMensaje(null);
        if (ganadores.length === 0) {
            setMensaje({ tipo: 'error', texto: 'No hay ganadores para generar certificados.' });
            return;
        }
        imprimirCertificados(ganadores, evento, { titulo: 'Certificados de premio' });
    };

    return (
        <div className="modal" onClick={cerrarModal}>
            <section className="formularios" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
                <button className="cerrar-formulario" onClick={cerrarModal} aria-label="Cerrar">X</button>
                <div className="formularios-header">
                    <span className="formularios-eyebrow">Premiación</span>
                    <h2>📜 Certificados de premio</h2>
                    <p>Cada certificado se abre en una hoja A4 horizontal lista para imprimir o guardar como PDF.</p>
                </div>

                {mensaje && <div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    {ganadores.length === 0 && (
                        <p style={{ color: '#5f5e5e', textAlign: 'center' }}>Aún no hay ganadores publicados.</p>
                    )}
                    {ganadores.map((g) => (
                        <div key={g.id_poster} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                            flexWrap: 'wrap', border: '1px solid rgba(19,39,64,0.08)', borderLeft: '4px solid #cad400',
                            borderRadius: '12px', padding: '0.85rem 1rem', background: '#fff'
                        }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, color: '#132740', overflowWrap: 'anywhere' }}>{g.titulo}</div>
                                <div style={{ fontSize: '0.85rem', color: '#5f5e5e', overflowWrap: 'anywhere' }}>
                                    {g.autores || g.nombre_autor} · <strong style={{ color: '#132740' }}>{g.premio || `${g.lugar}º lugar`}</strong>
                                </div>
                            </div>
                            <button className="boton-primario" style={{ minHeight: '40px' }} onClick={() => abrirUno(g)}>
                                📜 Certificado
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                    <button className="boton-primario" style={{ minHeight: '40px' }} onClick={abrirTodos}>
                        📥 Descargar todos
                    </button>
                    <button className="boton-secundario" style={{ minHeight: '40px' }} onClick={cerrarModal}>
                        Cerrar
                    </button>
                </div>
            </section>
        </div>
    );
};

export default CertificadoPremio;
