import React, { useState, useEffect, useMemo } from 'react';
import { FaTrashAlt, FaUserPlus, FaMapMarkerAlt, FaPrint, FaQrcode } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import EditarPoster from './EditarPoster';
import AsignarEvaluadorModal from './AsignarEvaluadorModal';
import AsignarEspacioModal from './AsignarEspacioModal';
import TarjetaPosterQR from './TarjetaPosterQR';
import VistaPreviaPoster from './VistaPreviaPoster';
import { obtenerRondasResumen } from '../../../api/rondasResumen.js';
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const construirUrlArchivo = (rutaImagen) => {
    if (!rutaImagen) return null;
    const nombreArchivo = rutaImagen.split('/').pop();
    return `${SERVER_URL}/imgPosters/${encodeURIComponent(nombreArchivo)}`;
};

const MostrarPostersAdmin = ({ cerrarTabla, onVerRanking = null }) => {
    const [posterParaAsignar, setPosterParaAsignar] = useState(null);
    const [posterParaEspacio, setPosterParaEspacio] = useState(null);
    const [posterAEditar, setPosterAEditar] = useState(null);
    const [posterParaQR, setPosterParaQR] = useState(null);
    const [posters, setPosters] = useState([]);
    const [rondas, setRondas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [posterEnVista, setPosterEnVista] = useState(null);
    const [filtro, setFiltro] = useState("");
    const [filtroEspacio, setFiltroEspacio] = useState("TODOS");

    // Filtros de evento y ronda (§6.2)
    const [eventosDisponibles, setEventosDisponibles] = useState([]);
    const [idEvento, setIdEvento] = useState("");
    const [idRonda, setIdRonda] = useState("");
    const [orden, setOrden] = useState("promedio_desc");
    const [soloSeleccionados, setSoloSeleccionados] = useState(false);
    const [soloPendientes, setSoloPendientes] = useState(false);

    // Filtros por nota (promedio general del póster, de todas las rondas).
    const [notaMinimaTexto, setNotaMinimaTexto] = useState("");
    const [notaMinima, setNotaMinima] = useState("");
    const [soloEvaluados, setSoloEvaluados] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setNotaMinima(notaMinimaTexto.trim()), 500);
        return () => clearTimeout(t);
    }, [notaMinimaTexto]);

    useEffect(() => {
        cargarRondas();
    }, []);

    useEffect(() => {
        cargarTodosPosters();
    }, [idEvento, idRonda, orden, soloSeleccionados, notaMinima, soloEvaluados]);

    const cargarRondas = async () => {
        try {
            const data = await obtenerRondasResumen();
            if (data.success) {
                const evs = data.data || [];
                setEventosDisponibles(evs);
                const lista = [];
                evs.forEach(ev => {
                    (ev.rondas || []).forEach(r => {
                        lista.push({
                            id_ronda: r.id_ronda,
                            id_evento: ev.id_evento,
                            numero: r.numero,
                            nombre: r.nombre,
                            estado: r.estado,
                            nombre_evento: ev.nombre_evento,
                            codigo_evento: ev.codigo_evento
                        });
                    });
                });
                setRondas(lista);
            }
        } catch (error) {
            console.error('Error al cargar rondas:', error);
        }
    };

    const cargarTodosPosters = async () => {
        try {
            setLoading(true);
            const params = ['todas_las_rondas=1'];
            // El orden y el filtro de nota se mandan siempre: sin ronda
            // seleccionada el servidor usa el promedio general del póster.
            params.push(`orden=${orden}`);
            if (notaMinima !== '') params.push(`nota_minima=${encodeURIComponent(notaMinima)}`);
            if (soloEvaluados) params.push('solo_evaluados=1');
            if (idEvento) params.push(`id_evento=${encodeURIComponent(idEvento)}`);
            if (idRonda) {
                params.push(`id_ronda=${idRonda}`);
                if (soloSeleccionados) params.push('solo_seleccionados=1');
            }
            const respuesta = await fetch(`${SERVER_URL}/api/TablaPosters.php?${params.join('&')}`);
            const datos = await respuesta.json();

            if (datos.success) {
                setPosters(datos.data);
            }
        } catch (error) {
            console.error('Error al cargar los pósters:', error);
        } finally {
            setLoading(false);
        }
    };

    const eliminarPoster = async (id) => {
        if (!window.confirm("¿Está seguro de que desea eliminar lógicamente este póster?")) return;

        try {
            const respuesta = await fetch(`${SERVER_URL}/api/TablaPosters.php`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const data = await respuesta.json();
            if (data.success) {
                setPosters(prev => prev.filter(p => p.id !== id));
            } else {
                alert("❌ Error al eliminar: " + data.message);
            }
        } catch (error) {
            console.error("Error:", error);
            alert("❌ Error de conexión: " + error.message);
        }
    };

    const espaciosDisponibles = useMemo(() => Array.from(
        new Set(posters.map(p => p.nombre_espacio).filter(Boolean))
    ), [posters]);

    const hayRonda = !!idRonda;

    const postersFiltrados = useMemo(() => {
        const texto = filtro.toLowerCase();
        return posters.filter(p => {
            const coincideTexto = `${p.titulo} ${p.autores} ${p.profesores_resumen || ''} ${p.descripcion} ${p.categoria} ${p.palabras_clave} ${p.nombre_usuario || ''} ${p.nombre_espacio || ''} ${p.nombre_evento || ''} ${p.codigo_evento || ''}`
                .toLowerCase()
                .includes(texto);

            const coincideEspacio = filtroEspacio === "TODOS"
                ? true
                : filtroEspacio === "SIN_ESPACIO"
                    ? !p.nombre_espacio
                    : p.nombre_espacio === filtroEspacio;

            const pendiente = hayRonda
                ? (parseInt(p.n_evaluaciones_ronda || 0, 10) === 0 || parseInt(p.pendientes_ronda || 0, 10) > 0)
                : false;

            return coincideTexto && coincideEspacio && (!soloPendientes || pendiente);
        });
    }, [posters, filtro, filtroEspacio, soloPendientes, hayRonda]);

    const totalColumnas = 18 + (hayRonda ? 3 : 0);

    // Escapa texto/HTML para inyectarlo con seguridad en el documento de impresión.
    const esc = (valor) => String(valor ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Imprime el inventario en un documento limpio y dedicado (una tarjeta por
    // póster con la información principal). Evita el corte de la tabla ancha.
    const imprimirInventario = () => {
        const lista = postersFiltrados;
        if (!lista.length) {
            alert('No hay pósters para imprimir con los filtros actuales.');
            return;
        }

        const filas = lista.map(p => {
            const textoEspacio = p.nombre_espacio
                ? `${esc(p.nombre_espacio)}${p.ubicacion_detallada ? ` #${esc(p.ubicacion_detallada)}` : ''}`
                : 'Sin asignar';
            return `
            <article class="poster">
                <header class="poster-cab">
                    <h3>${esc(p.titulo)}</h3>
                    <span class="nota">${p.promedio_general != null ? `★ ${esc(p.promedio_general)}` : 'Sin nota'}</span>
                </header>
                <div class="grid">
                    <div><span class="et">Autores</span><span class="val">${esc(p.autores) || '—'}</span></div>
                    <div><span class="et">Profesores y materias</span><span class="val">${esc(p.profesores_resumen) || 'Sin asignar'}</span></div>
                    <div><span class="et">Evento</span><span class="val">${esc(p.nombre_evento) || 'Sin evento'}${p.codigo_evento ? ` (${esc(p.codigo_evento)})` : ''}</span></div>
                    <div><span class="et">Categoría</span><span class="val">${esc(p.categoria) || '—'}</span></div>
                    <div><span class="et">Espacio físico</span><span class="val">${textoEspacio}</span></div>
                    <div><span class="et">Usuario</span><span class="val">${esc(p.nombre_usuario) || 'Sin usuario'}</span></div>
                    <div><span class="et">Fecha de registro</span><span class="val">${esc(p.fecha_registro) || '—'}</span></div>
                </div>
                <p class="desc"><span class="et">Descripción:</span> ${esc(p.descripcion) || '—'}</p>
                <p class="claves"><span class="et">Palabras clave:</span> ${esc(p.palabras_clave) || '—'}</p>
            </article>
        `;
        }).join('');

        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { window.print(); return; }
        win.document.write(`
            <html>
            <head>
                <title>Inventario de Pósters</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: system-ui, -apple-system, sans-serif; color:#132740; margin:0; padding:1.5rem; background:#fff; }
                    .encab { text-align:center; margin-bottom:1.25rem; border-bottom:2px solid #00acc9; padding-bottom:0.75rem; }
                    .encab h2 { margin:0; color:#132740; font-size:1.3rem; }
                    .encab .sub { color:#5f5e5e; font-size:0.85rem; margin:0.25rem 0 0; }
                    .poster { border:1px solid rgba(19,39,64,0.10); border-top:4px solid #00acc9; border-radius:14px; padding:1rem 1.1rem; margin-bottom:1rem; break-inside:avoid; page-break-inside:avoid; }
                    .poster-cab { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:0.6rem; }
                    .poster-cab h3 { margin:0; color:#132740; font-size:1.02rem; line-height:1.3; }
                    .nota { background:#132740; color:#cad400; font-weight:700; font-size:0.8rem; padding:4px 10px; border-radius:999px; white-space:nowrap; }
                    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.5rem 1rem; margin-bottom:0.6rem; }
                    .grid > div { min-width:0; }
                    .et { display:block; font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:#5f5e5e; font-weight:700; }
                    .val { display:block; font-size:0.86rem; color:#132740; word-break:break-word; }
                    .desc, .claves { margin:0.35rem 0 0; font-size:0.84rem; color:#333; line-height:1.4; }
                    .desc .et, .claves .et { display:inline; color:#132740; }
                    .pie { text-align:center; color:#5f5e5e; font-size:0.75rem; margin-top:1rem; }
                    @media print { body { padding:0; } }
                </style>
            </head>
            <body>
                <div class="encab">
                    <h2>Inventario de Pósters</h2>
                    <p class="sub">Universidad Cooperativa de Colombia — GensTI · ${lista.length} póster${lista.length === 1 ? '' : 's'}</p>
                </div>
                ${filas}
                <p class="pie">Generado desde Gestión e Inventario de Pósters</p>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 350);
    };

    return (
        <div className="todos-posters" style={{ width: '100%', boxSizing: 'border-box' }}>
            {cerrarTabla && (
                <button className="cerrar-tabla" onClick={cerrarTabla}>×</button>
            )}

            <h2>
                Gestión e Inventario de Pósters
                {eventosDisponibles.length === 1 && eventosDisponibles[0]?.nombre_evento
                    ? ` · ${eventosDisponibles[0].nombre_evento}`
                    : ''}
            </h2>

            {/* Barra de Filtros */}
            <div className="filtros filtros-inventario">
                <input
                    type="text"
                    placeholder="Buscar por título, autores, evento, categoría..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro filtro-busqueda"
                />

                {eventosDisponibles.length > 1 && (
                    <select
                        value={idEvento}
                        onChange={(e) => {
                            setIdEvento(e.target.value);
                            setIdRonda("");
                        }}
                        className="input-filtro"
                        aria-label="Filtrar por evento"
                    >
                        <option value="">🗓️ Todos los eventos</option>
                        {eventosDisponibles.map(ev => (
                            <option key={ev.id_evento} value={ev.id_evento}>
                                🗓️ {ev.nombre_evento} ({ev.codigo_evento})
                            </option>
                        ))}
                    </select>
                )}

                <select
                    value={filtroEspacio}
                    onChange={(e) => setFiltroEspacio(e.target.value)}
                    className="input-filtro"
                    aria-label="Filtrar por espacio físico"
                >
                    <option value="TODOS">📍 Todos los espacios</option>
                    <option value="SIN_ESPACIO">⚠️ Sin ubicación</option>
                    {espaciosDisponibles.map((espacio, index) => (
                        <option key={index} value={espacio}>🏛️ {espacio}</option>
                    ))}
                </select>

                <select
                    value={idRonda}
                    onChange={(e) => setIdRonda(e.target.value)}
                    className="input-filtro"
                    aria-label="Filtrar por ronda"
                >
                    <option value="">Todas las rondas</option>
                    {rondas
                        .filter(r => !idEvento || String(r.id_evento) === String(idEvento))
                        .map(r => (
                            <option key={r.id_ronda} value={r.id_ronda}>
                                {eventosDisponibles.length > 1 && !idEvento ? `[${r.nombre_evento}] ` : ''}
                                Ronda {r.numero} · {r.nombre} {r.estado === 'cerrada' ? '(cerrada)' : ''}
                            </option>
                        ))}
                </select>

                <select
                    value={orden}
                    onChange={(e) => setOrden(e.target.value)}
                    className="input-filtro"
                    aria-label="Ordenar por nota"
                    title="Ronda: ordena por el promedio de la ronda seleccionada. Nota general: ordena por el promedio de todas las rondas evaluadas."
                >
                    <option value="promedio_desc">Ronda: mayor a menor</option>
                    <option value="promedio_asc">Ronda: menor a mayor</option>
                    <option value="nota_desc">Nota general: mayor a menor</option>
                    <option value="nota_asc">Nota general: menor a mayor</option>
                    <option value="fecha">Más recientes</option>
                    <option value="titulo_asc">Título (A - Z)</option>
                </select>

                <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="Nota mín. (1 - 5)"
                    value={notaMinimaTexto}
                    onChange={(e) => setNotaMinimaTexto(e.target.value)}
                    className="input-filtro filtro-nota"
                    aria-label="Mostrar solo pósters con nota igual o superior a este valor"
                    title="Muestra solo los pósters cuya nota promedio sea igual o superior a este valor (de 1 a 5)"
                />

                <div className="filtros-checks">
                    <label className="filtro-check">
                        <input
                            type="checkbox"
                            checked={soloEvaluados}
                            onChange={(e) => setSoloEvaluados(e.target.checked)}
                        />
                        Solo con nota
                    </label>

                    <label className="filtro-check">
                        <input
                            type="checkbox"
                            checked={soloSeleccionados}
                            onChange={(e) => setSoloSeleccionados(e.target.checked)}
                        />
                        Solo seleccionados
                    </label>

                    <label className="filtro-check">
                        <input
                            type="checkbox"
                            checked={soloPendientes}
                            onChange={(e) => setSoloPendientes(e.target.checked)}
                        />
                        Solo pendientes de calificar
                    </label>
                </div>

                <button className="btn-imprimir" onClick={imprimirInventario}>
                    <FaPrint /> Imprimir
                </button>
            </div>

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Autores</th>
                            <th>Profesores / Materias</th>
                            <th>Evento</th>
                            {hayRonda && <th>Promedio</th>}
                            {hayRonda && <th>Estado</th>}
                            {hayRonda && <th>Selección</th>}
                            <th>Nota promedio</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Espacio Físico</th>
                            <th>Palabras Clave</th>
                            <th>Imagen</th>
                            <th>Fecha</th>
                            <th>Usuario</th>
                            <th>Ubicación</th>
                            <th>Evaluadores</th>
                            <th>Código QR</th>
                            <th>Ranking</th>
                            <th>Editar</th>
                            <th>Eliminar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={totalColumnas} style={{ textAlign: "center", padding: "20px" }}>
                                    Cargando pósters...
                                </td>
                            </tr>
                        ) : postersFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan={totalColumnas} style={{ textAlign: "center", padding: "20px" }}>
                                    No hay pósters registrados o activos.
                                </td>
                            </tr>
                        ) : (
                            postersFiltrados.map(poster => (
                                <tr key={poster.id}>
                                    <td><strong>{poster.titulo}</strong></td>
                                    <td>{poster.autores}</td>

                                    <td>
                                        {Array.isArray(poster.profesores) && poster.profesores.length > 0 ? (
                                            <div className="celda-profesores">
                                                {poster.profesores.map((pr, idx) => (
                                                    <span className="badge-profesor-materia" key={pr.id || idx}>
                                                        👨‍🏫 {pr.nombre_profesor}
                                                        {pr.materia && <small> · {pr.materia}</small>}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : poster.profesores_resumen ? (
                                            <span>{poster.profesores_resumen}</span>
                                        ) : (
                                            <span className="subtexto-celda">—</span>
                                        )}
                                    </td>

                                    <td>
                                        {poster.nombre_evento ? (
                                            <span className="badge-evento">
                                                <span className="badge-evento-icono" aria-hidden="true">🎓</span>
                                                <span className="badge-evento-texto">
                                                    {poster.nombre_evento}
                                                    {poster.codigo_evento && (
                                                        <small>{poster.codigo_evento}</small>
                                                    )}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="sin-evento">Sin evento</span>
                                        )}
                                    </td>

                                    {/* Estadísticas de la ronda activa */}
                                    {hayRonda && (
                                        <td>
                                            <span className="promedio-ronda">{poster.promedio_ronda ?? '—'}</span>
                                            <div className="subtexto-celda">
                                                {poster.n_evaluaciones_ronda || 0}
                                                {poster.evaluadores_ronda > 0 ? ` de ${poster.evaluadores_ronda}` : ''} evaluaciones
                                            </div>
                                        </td>
                                    )}
                                    {hayRonda && (
                                        <td>
                                            <span className={`badge-rol ${poster.n_evaluaciones_ronda === 0 ? 'rol-1' : (poster.pendientes_ronda > 0 ? 'rol-4' : 'rol-2')}`}>
                                                {poster.estado_evaluacion || 'Sin evaluar'}
                                            </span>
                                        </td>
                                    )}
                                    {hayRonda && (
                                        <td>
                                            {poster.lugar ? (
                                                <span className="badge-premio">🏆 {poster.premio || `${poster.lugar}º lugar`}</span>
                                            ) : poster.seleccionado ? (
                                                <span className="badge-rol rol-2">Seleccionado</span>
                                            ) : (
                                                <span className="subtexto-celda">—</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Promedio sobre todas las rondas: siempre visible para el admin, incluso
                                        sin ronda seleccionada. Es la columna que usa el filtro de nota. */}
                                    <td>
                                        {poster.promedio_general !== null && poster.promedio_general !== undefined ? (
                                            <>
                                                <span className="promedio-ronda">{poster.promedio_general}</span>
                                                <div className="subtexto-celda">
                                                    {poster.n_evaluaciones_general || 0} evaluaciones
                                                </div>
                                            </>
                                        ) : (
                                            <span className="subtexto-celda">Sin nota</span>
                                        )}
                                    </td>

                                    <td className="descripcion-celda">{poster.descripcion}</td>
                                    <td><span className="badge-categoria">{poster.categoria}</span></td>

                                    <td>
                                        {poster.nombre_espacio ? (
                                            <span className="badge-ubicacion-espacio">
                                                <span aria-hidden="true">📍</span>
                                                <span>{poster.nombre_espacio}</span>
                                                {poster.ubicacion_detallada && (
                                                    <strong className="badge-ubicacion-num">
                                                        #{poster.ubicacion_detallada}
                                                    </strong>
                                                )}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#dc3545', fontStyle: 'italic' }}>
                                                Sin Asignar
                                            </span>
                                        )}
                                    </td>

                                    <td>{poster.palabras_clave}</td>

                                    <td>
                                        {poster.imagen ? (
                                            poster.imagen.toLowerCase().endsWith('.pdf') ? (
                                                <div
                                                    className="pdf-miniatura"
                                                    onClick={() => setPosterEnVista(poster)}
                                                    style={{ cursor: "pointer", color: '#0056b3', textDecoration: 'underline' }}
                                                >
                                                    <small>(Ver PDF)</small>
                                                </div>
                                            ) : (
                                                <img
                                                    src={construirUrlArchivo(poster.imagen)}
                                                    alt={poster.titulo}
                                                    className="img-miniatura"
                                                    loading="lazy"
                                                    onClick={() => setPosterEnVista(poster)}
                                                    style={{ cursor: "pointer", width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
                                                />
                                            )
                                        ) : (
                                            <span className="sin-imagen">Sin archivo</span>
                                        )}
                                    </td>

                                    <td>{poster.fecha_registro}</td>
                                    <td>{poster.nombre_usuario || 'Sin usuario'}</td>

                                    {/* Botón Asignar Espacio Físico */}
                                    <td>
                                        <button
                                            className="btn-accion"
                                            title="Asignar Espacio Físico"
                                            onClick={() => setPosterParaEspacio(poster)}
                                            style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            <FaMapMarkerAlt />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            title="Asignar Evaluadores"
                                            onClick={() => setPosterParaAsignar(poster)}
                                        >
                                            <FaUserPlus />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-accion"
                                            title="Ver código QR del póster"
                                            onClick={() => setPosterParaQR(poster)}
                                            style={{ background: '#6f42c1', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            <FaQrcode />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-accion-tabla btn-ranking-tabla"
                                            title="Ver en ranking de ronda"
                                            onClick={() => onVerRanking && onVerRanking(poster)}
                                        >
                                            📊 Ranking
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            title="Editar Póster"
                                            onClick={() => setPosterAEditar(poster)}
                                        >
                                            <FaRegPenToSquare />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            title="Eliminar Póster"
                                            onClick={() => eliminarPoster(poster.id)}
                                        >
                                            <FaTrashAlt />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Vista previa con datos del póster arriba y el archivo (imagen / PDF) abajo */}
            {posterEnVista && (
                <VistaPreviaPoster poster={posterEnVista} cerrarModal={() => setPosterEnVista(null)} />
            )}

            {/* Modal de Edición */}
            {posterAEditar && (
                <div className="modal">
                    <EditarPoster
                        poster={posterAEditar}
                        cerrarModal={() => setPosterAEditar(null)}
                        alGuardarExitoso={cargarTodosPosters}
                    />
                </div>
            )}

            {/* Modal de Asignación de Evaluadores */}
            {posterParaAsignar && (
                <div className="modal">
                    <AsignarEvaluadorModal
                        poster={posterParaAsignar}
                        idRonda={idRonda || null}
                        cerrarModal={() => {
                            setPosterParaAsignar(null);
                            cargarTodosPosters();
                        }}
                    />
                </div>
            )}

            {/* Modal de Asignación de Espacio Físico (Corregido para centrarse correctamente) */}
            {posterParaEspacio && (
                <AsignarEspacioModal
                    poster={posterParaEspacio}
                    cerrarModal={() => setPosterParaEspacio(null)}
                    alActualizar={cargarTodosPosters}
                />
            )}

            {/* Modal de Código QR - mismo diseño que Categorías */}
            {posterParaQR && (
                <div className="modal" onClick={() => setPosterParaQR(null)}>
                    <section className="formularios" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <button className="cerrar-formulario" onClick={() => setPosterParaQR(null)}>X</button>
                        <h2>📱 Código QR del Póster</h2>
                        <p>Escanea para ver la versión digital</p>
                        <TarjetaPosterQR
                            poster={posterParaQR}
                            urlDigital={construirUrlArchivo(posterParaQR.imagen) || `${window.location.origin}/poster/${posterParaQR.id}`}
                        />
                    </section>
                </div>
            )}
        </div>
    );
};

export default MostrarPostersAdmin;