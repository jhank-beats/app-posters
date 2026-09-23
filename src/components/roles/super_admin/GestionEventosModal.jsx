import React, { useState, useEffect } from 'react';
import { FaCheckCircle } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import "../generales/roles.css";
import "../../formularios/Formulario.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const GestionEventosModal = ({ cerrarTabla }) => {
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState("");
    const [mostrarModal, setMostrarModal] = useState(false);
    const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
    const [nombreEvento, setNombreEvento] = useState("");
    const [codigoEvento, setCodigoEvento] = useState("");
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");
    const [error, setError] = useState("");

    useEffect(() => { cargarEventos(); }, []);

    const cargarEventos = async () => {
        try {
            const respuesta = await fetch(`${SERVER_URL}/api/Eventos.php`);
            const datos = await respuesta.json();
            if (datos.status === 'success') setEventos(datos.data || []);
        } catch (err) { console.error("Error al cargar eventos:", err); }
        finally { setLoading(false); }
    };

    const ModificarEvento = (evento) => {
        setEventoSeleccionado(evento.id_evento);
        setNombreEvento(evento.nombre_evento || "");
        setCodigoEvento(evento.codigo_evento || "");
        setFechaInicio(evento.fecha_inicio || "");
        setFechaFin(evento.fecha_fin || "");
        setError("");
        setMostrarModal(true);
    };

    const activarEvento = async (id_evento) => {
        const rolUsuario = localStorage.getItem('rol') || 'superadmin';
        try {
            const respuesta = await fetch(`${SERVER_URL}/api/Eventos.php`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'activar', id_evento, rol_usuario: rolUsuario }) });
            const data = await respuesta.json();
            if (data.status === 'success') { alert("✅ Evento activado correctamente"); cargarEventos(); }
            else alert("❌ Error: " + data.message);
        } catch (err) { alert("❌ Error de conexión al activar evento"); }
    };

    const guardarEvento = async (e) => {
        e.preventDefault(); setError("");
        if (!nombreEvento.trim() || !codigoEvento.trim()) { setError("El nombre y código del evento son obligatorios"); return; }
        const rolUsuario = localStorage.getItem('rol') || 'superadmin';
        const metodo = eventoSeleccionado ? "PUT" : "POST";
        const payload = { rol_usuario: rolUsuario, id_evento: eventoSeleccionado, nombre_evento: nombreEvento, codigo_evento: codigoEvento, fecha_inicio: fechaInicio, fecha_fin: fechaFin };
        try {
            const respuesta = await fetch(`${SERVER_URL}/api/Eventos.php`, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await respuesta.json();
            if (data.status === 'success') {
                alert(`✅ ${data.message}`);
                setMostrarModal(false); setNombreEvento(""); setCodigoEvento(""); setFechaInicio(""); setFechaFin(""); setEventoSeleccionado(null); cargarEventos();
            } else setError(data.message || "Error al guardar el evento");
        } catch (err) { setError("Error al conectar con el servidor"); }
    };

    const eventosFiltrados = eventos.filter(ev =>
        ev.nombre_evento.toLowerCase().includes(filtro.toLowerCase()) ||
        ev.codigo_evento.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <div className="formularios" style={{ maxWidth: '850px' }}>
            {cerrarTabla && (<button className="cerrar-formulario" onClick={cerrarTabla} aria-label="Cerrar">X</button>)}
            <div className="formularios-header">
                <span className="formularios-eyebrow">Calendario</span>
                <h2>Gestión de Eventos y Semestres</h2>
                <p>Administra periodos académicos y activa el evento vigente</p>
            </div>

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre del Evento</th>
                            <th>Código</th>
                            <th>Fechas (Inicio / Fin)</th>
                            <th>Estado</th>
                            <th>Modificar</th>
                            <th>Activar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ textAlign: "center" }}>Cargando eventos...</td></tr>
                        ) : eventosFiltrados.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: "center" }}>No hay eventos registrados</td></tr>
                        ) : (
                            eventosFiltrados.map((ev) => (
                                <tr key={ev.id_evento}>
                                    <td><strong>{ev.nombre_evento}</strong></td>
                                    <td>{ev.codigo_evento}</td>
                                    <td>{ev.fecha_inicio ? `${ev.fecha_inicio} a ${ev.fecha_fin || 'Sin fin'}` : 'Sin definir'}</td>
                                    <td>{ev.activo == 1 ? (<span className="badge-rol rol-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><FaCheckCircle /> ACTIVO</span>) : (<span className="badge-rol rol-1">Inactivo</span>)}</td>
                                    <td><button className="btn-rechazar" onClick={() => ModificarEvento(ev)} title="Modificar evento"><FaRegPenToSquare /></button></td>
                                    <td>{ev.activo != 1 ? (<button className="btn-rechazar" onClick={() => activarEvento(ev.id_evento)} title="Activar este evento" style={{ color: '#80ba27', borderColor: '#80ba27' }}><FaCheckCircle /></button>) : (<span className="badge-rol rol-2">Vigente</span>)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
                <button className='boton-primario' onClick={() => { setEventoSeleccionado(null); setNombreEvento(""); setCodigoEvento(""); setFechaInicio(""); setFechaFin(""); setError(""); setMostrarModal(true); }}>+ Agregar Evento</button>
                <div className="filtros" style={{ margin: 0, padding: 0 }}><input type="text" placeholder="Buscar por evento o código..." value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
            </div>

            {mostrarModal && (
                <div className="modal">
                    <div className="formularios">
                        <button className='cerrar-formulario' onClick={() => setMostrarModal(false)} aria-label="Cerrar">X</button>
                        <div className="formularios-header">
                            <span className="formularios-eyebrow">{eventoSeleccionado ? "Edición" : "Nuevo"}</span>
                            <h2>📅 {eventoSeleccionado ? "Editar Evento" : "Agregar Evento"}</h2>
                            <p>{eventoSeleccionado ? "Modifica los datos del evento o semestre" : "Crea un nuevo semestre académico o evento"}</p>
                        </div>
                        <form className="formularios-body" onSubmit={guardarEvento}>
                            <div className="campo-formulario"><input type="text" placeholder="🏷️ Nombre del evento (Ej: Semestre B 2026)" value={nombreEvento} onChange={(e) => setNombreEvento(e.target.value)} /></div>
                            <div className="campo-formulario"><input type="text" placeholder="🔑 Código único (Ej: 2026-B)" value={codigoEvento} onChange={(e) => setCodigoEvento(e.target.value)} /></div>
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
