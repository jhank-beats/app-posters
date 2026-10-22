import React, { useState, useEffect } from 'react';
import { FaCheckCircle } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import "../generales/roles.css";
import "../../formularios/Formulario.css";
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';


const etiquetaCarrera = (carrera) => {
    const c = (carrera || 'sistemas').toLowerCase();
    if (c === 'civil') return '🏗️ Ingeniería Civil';
    if (c === 'ambas') return '🤝 Ambas (Sistemas y Civil)';
    return '💻 Ingeniería de Sistemas';
};

const GestionEventosModal = ({ cerrarTabla, cerrarModal }) => {
    const idRolActual = parseInt(localStorage.getItem('id_rol') || '4', 10);
    const carreraPorDefecto = idRolActual === 5 ? 'civil' : 'sistemas';

    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState("");
    const [filtroCarrera, setFiltroCarrera] = useState("todas");
    const [mostrarModal, setMostrarModal] = useState(false);
    const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
    const [nombreEvento, setNombreEvento] = useState("");
    const [codigoEvento, setCodigoEvento] = useState("");
    const [carreraEvento, setCarreraEvento] = useState(carreraPorDefecto);
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");
    const [error, setError] = useState("");

    const cerrar = cerrarTabla || cerrarModal;

    useEffect(() => { cargarEventos(); }, []);

    const cargarEventos = async () => {
        try {
            const respuesta = await fetch(`${API_BASE}/Eventos.php`);
            const datos = await respuesta.json();
            if (datos.status === 'success' || datos.success) setEventos(datos.data || []);
        } catch (err) { console.error("Error al cargar eventos:", err); }
        finally { setLoading(false); }
    };

    const ModificarEvento = (evento) => {
        setEventoSeleccionado(evento.id_evento);
        setNombreEvento(evento.nombre_evento || "");
        setCodigoEvento(evento.codigo_evento || "");
        setCarreraEvento(evento.carrera || carreraPorDefecto);
        setFechaInicio(evento.fecha_inicio || "");
        setFechaFin(evento.fecha_fin || "");
        setError("");
        setMostrarModal(true);
    };

    const activarEvento = async (id_evento) => {
        try {
            const respuesta = await fetch(`${API_BASE}/Eventos.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'activar', id_evento })
            });
            const data = await respuesta.json();
            if (data.status === 'success' || data.success) {
                alert("✅ " + (data.message || "Evento activado correctamente"));
                cargarEventos();
            } else {
                alert("❌ Error: " + data.message);
            }
        } catch { alert("❌ Error de conexión al activar evento"); }
    };

    const guardarEvento = async (e) => {
        e.preventDefault(); setError("");
        if (!nombreEvento.trim() || !codigoEvento.trim()) { setError("El nombre y código del evento son obligatorios"); return; }
        const metodo = eventoSeleccionado ? "PUT" : "POST";
        const payload = {
            id_evento: eventoSeleccionado,
            nombre_evento: nombreEvento,
            codigo_evento: codigoEvento,
            carrera: carreraEvento,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        };
        try {
            const respuesta = await fetch(`${API_BASE}/Eventos.php`, {
                method: metodo,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await respuesta.json();
            if (data.status === 'success' || data.success) {
                alert(`✅ ${data.message}`);
                setMostrarModal(false);
                setNombreEvento("");
                setCodigoEvento("");
                setCarreraEvento(carreraPorDefecto);
                setFechaInicio("");
                setFechaFin("");
                setEventoSeleccionado(null);
                cargarEventos();
            } else setError(data.message || "Error al guardar el evento");
        } catch { setError("Error al conectar con el servidor"); }
    };

    const eventosFiltrados = eventos.filter(ev => {
        const coincideTexto =
            (ev.nombre_evento || "").toLowerCase().includes(filtro.toLowerCase()) ||
            (ev.codigo_evento || "").toLowerCase().includes(filtro.toLowerCase());
        const coincideCarrera =
            filtroCarrera === "todas" ||
            (ev.carrera || "sistemas") === filtroCarrera ||
            (ev.carrera === "ambas" && (filtroCarrera === "sistemas" || filtroCarrera === "civil"));
        return coincideTexto && coincideCarrera;
    });

    return (
        <div className="formularios" style={{ maxWidth: '920px' }}>
            {cerrar && (<button className="cerrar-formulario" onClick={cerrar} aria-label="Cerrar">X</button>)}
            <div className="formularios-header">
                <span className="formularios-eyebrow">Calendario por Carrera</span>
                <h2>Gestión de Eventos y Semestres</h2>
                <p>Administra periodos académicos de Ingeniería de Sistemas e Ingeniería Civil (puedes tener un evento activo por cada carrera)</p>
            </div>

            {/* Cuerpo con scroll: el header con la X y los botones quedan fijos. */}
            <div className="formularios-body">
                <div className="contenedor-tabla">
                  <HintScrollTabla />
                    <table>
                    <thead>
                        <tr>
                            <th>Nombre del Evento</th>
                            <th>Código</th>
                            <th>Carrera</th>
                            <th>Fechas (Inicio / Fin)</th>
                            <th>Estado</th>
                            <th>Modificar</th>
                            <th>Activar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ textAlign: "center" }}>Cargando eventos...</td></tr>
                        ) : eventosFiltrados.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: "center" }}>No hay eventos registrados</td></tr>
                        ) : (
                            eventosFiltrados.map((ev) => (
                                <tr key={ev.id_evento}>
                                    <td><strong>{ev.nombre_evento}</strong></td>
                                    <td>{ev.codigo_evento}</td>
                                    <td>
                                        <span className={`badge-rol ${ev.carrera === 'civil' ? 'rol-5' : 'rol-4'}`} style={{ textTransform: 'none' }}>
                                            {etiquetaCarrera(ev.carrera)}
                                        </span>
                                    </td>
                                    <td>{ev.fecha_inicio ? `${ev.fecha_inicio} a ${ev.fecha_fin || 'Sin fin'}` : 'Sin definir'}</td>
                                    <td>{ev.activo == 1 ? (<span className="badge-rol rol-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><FaCheckCircle /> ACTIVO</span>) : (<span className="badge-rol rol-1">Inactivo</span>)}</td>
                                    <td><button className="btn-rechazar" onClick={() => ModificarEvento(ev)} title="Modificar evento"><FaRegPenToSquare /></button></td>
                                    <td>{ev.activo != 1 ? (<button className="btn-rechazar" onClick={() => activarEvento(ev.id_evento)} title="Activar este evento para su carrera" style={{ color: '#80ba27', borderColor: '#80ba27' }}><FaCheckCircle /></button>) : (<span className="badge-rol rol-2">Vigente</span>)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                <button className='boton-primario' onClick={() => {
                    setEventoSeleccionado(null);
                    setNombreEvento("");
                    setCodigoEvento("");
                    setCarreraEvento(carreraPorDefecto);
                    setFechaInicio("");
                    setFechaFin("");
                    setError("");
                    setMostrarModal(true);
                }}>+ Agregar Evento</button>
                <div className="filtros" style={{ margin: 0, padding: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select value={filtroCarrera} onChange={(e) => setFiltroCarrera(e.target.value)} aria-label="Filtrar por carrera">
                        <option value="todas">🎓 Todas las carreras</option>
                        <option value="sistemas">💻 Ing. de Sistemas</option>
                        <option value="civil">🏗️ Ing. Civil</option>
                    </select>
                    <input type="text" placeholder="Buscar por evento o código..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                </div>
            </div>
            </div>

            {mostrarModal && (
                <div className="modal">
                    <div className="formularios">
                        <button className='cerrar-formulario' onClick={() => setMostrarModal(false)} aria-label="Cerrar">X</button>
                        <div className="formularios-header">
                            <span className="formularios-eyebrow">{eventoSeleccionado ? "Edición" : "Nuevo"}</span>
                            <h2>📅 {eventoSeleccionado ? "Editar Evento" : "Agregar Evento"}</h2>
                            <p>{eventoSeleccionado ? "Modifica los datos del evento o semestre" : "Crea un nuevo semestre académico o evento por carrera"}</p>
                        </div>
                        <form className="formularios-body" onSubmit={guardarEvento}>
                            <div className="campo-formulario"><input type="text" placeholder="🏷️ Nombre del evento (Ej: Semestre B 2026)" value={nombreEvento} onChange={(e) => setNombreEvento(e.target.value)} /></div>
                            <div className="campo-formulario"><input type="text" placeholder="🔑 Código único (Ej: 2026-B)" value={codigoEvento} onChange={(e) => setCodigoEvento(e.target.value)} /></div>
                            <div className="campo-formulario">
                                <label>Carrera del Evento</label>
                                <select value={carreraEvento} onChange={(e) => setCarreraEvento(e.target.value)}>
                                    <option value="sistemas">💻 Ingeniería de Sistemas</option>
                                    <option value="civil">🏗️ Ingeniería Civil</option>
                                    <option value="ambas">🤝 Ambas carreras (Sistemas y Civil)</option>
                                </select>
                            </div>
                            <div className="campo-formulario"><label>Fecha de Inicio</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
                            <div className="campo-formulario"><label>Fecha de Cierre</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
                            <button className="boton-primario" type="submit">Guardar Cambios</button>
                            {error && <p className="error-mensaje">{error}</p>}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionEventosModal;
