import React, { useState, useEffect } from 'react';
import './roles.css';
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';


const GestionEspaciosModal = ({ cerrarModal }) => {
    const [espacios, setEspacios] = useState([]);
    const [eventosActivos, setEventosActivos] = useState([]);
    const [idEventoSeleccionado, setIdEventoSeleccionado] = useState('');
    const [nombreEspacio, setNombreEspacio] = useState('');
    const [capacidad, setCapacidad] = useState('');
    const [mensaje, setMensaje] = useState(null);

    // Edición
    const [editando, setEditando] = useState(null); // {id_espacio, nombre_espacio, capacidad, id_evento}

    const rolActual = parseInt(localStorage.getItem("id_rol") || "0", 10);
    const esSuperAdmin = rolActual === 4;

    useEffect(() => {
        cargarEspacios();
        if (esSuperAdmin) {
            cargarEventosActivos();
        }
    }, []);

    const cargarEventosActivos = async () => {
        try {
            const res = await fetch(`${API_BASE}/Eventos.php?activo=1`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                const lista = Array.isArray(data.eventos_activos) && data.eventos_activos.length > 0
                    ? data.eventos_activos
                    : (data.data ? [data.data] : []);
                setEventosActivos(lista);
                if (lista.length > 0 && !idEventoSeleccionado) {
                    setIdEventoSeleccionado(String(lista[0].id_evento));
                }
            }
        } catch (error) {
            console.error("Error al cargar eventos activos:", error);
        }
    };

    const cargarEspacios = async () => {
        try {
            const res = await fetch(`${API_BASE}/Espacios.php`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEspacios(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar espacios:", error);
        }
    };

    const resetFormulario = () => {
        setEditando(null);
        setNombreEspacio('');
        setCapacidad('');
    };

    const guardarEspacio = async (e) => {
        e.preventDefault();
        setMensaje(null);
        if (!nombreEspacio.trim() || !capacidad) {
            setMensaje({ tipo: 'error', texto: 'Por favor complete todos los campos' });
            return;
        }

        try {
            let res;
            if (editando) {
                const cuerpo = {
                    accion: 'editar_espacio',
                    id_espacio: editando.id_espacio,
                    nombre_espacio: nombreEspacio.trim(),
                    capacidad: parseInt(capacidad, 10),
                };
                if (esSuperAdmin && idEventoSeleccionado) {
                    cuerpo.id_evento = parseInt(idEventoSeleccionado, 10);
                }
                res = await fetch(`${API_BASE}/Espacios.php`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(cuerpo)
                });
            } else {
                const cuerpoPeticion = {
                    nombre_espacio: nombreEspacio.trim(),
                    capacidad: parseInt(capacidad, 10),
                    ubicacion_detallada: ""
                };
                if (esSuperAdmin && idEventoSeleccionado) {
                    cuerpoPeticion.id_evento = parseInt(idEventoSeleccionado, 10);
                }
                res = await fetch(`${API_BASE}/Espacios.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(cuerpoPeticion)
                });
            }

            const textResponse = await res.text();
            let data;
            try {
                data = JSON.parse(textResponse);
            } catch {
                console.error("El servidor no devolvió un JSON válido:", textResponse);
                setMensaje({ tipo: 'error', texto: 'Error de formato en el servidor' });
                return;
            }
            if (data.status === 'success' || data.success) {
                setMensaje({
                    tipo: 'exito',
                    texto: editando ? 'Espacio actualizado exitosamente' : 'Espacio físico creado exitosamente'
                });
                resetFormulario();
                cargarEspacios();
            } else {
                setMensaje({ tipo: 'error', texto: data.message || (editando ? 'Error al editar espacio' : 'Error al crear espacio') });
            }
        } catch (error) {
            console.error("Error de red:", error);
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        }
    };

    const iniciarEdicion = (esp) => {
        setMensaje(null);
        setEditando({
            id_espacio: esp.id_espacio,
            nombre_espacio: esp.nombre_espacio,
            capacidad: esp.capacidad,
            id_evento: esp.id_evento,
        });
        setNombreEspacio(esp.nombre_espacio || '');
        setCapacidad(String(esp.capacidad ?? ''));
        if (esSuperAdmin && esp.id_evento) {
            setIdEventoSeleccionado(String(esp.id_evento));
        }
    };

    const eliminarEspacio = async (esp) => {
        setMensaje(null);
        const ocupados = parseInt(esp.ocupacion_actual ?? esp.ocupados ?? 0, 10);
        const aviso = ocupados > 0
            ? `"${esp.nombre_espacio}" tiene ${ocupados} póster(es). Se desasignarán (quedarán sin ubicación) y el espacio se eliminará. ¿Continuar?`
            : `¿Eliminar el espacio "${esp.nombre_espacio}"?`;
        if (!window.confirm(aviso)) return;

        try {
            const res = await fetch(`${API_BASE}/Espacios.php?id_espacio=${esp.id_espacio}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setMensaje({ tipo: 'exito', texto: data.message || 'Espacio eliminado' });
                if (editando && editando.id_espacio === esp.id_espacio) resetFormulario();
                cargarEspacios();
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'Error al eliminar espacio' });
            }
        } catch (error) {
            console.error("Error de red al eliminar:", error);
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        }
    };

    const colSpan = esSuperAdmin ? 5 : 4;

    return (
        <div className="modal">
            <div className="modal-espacios-contenido">
                <button className="cerrar-modal" onClick={cerrarModal} aria-label="Cerrar">×</button>
                <span className="seccion-eyebrow">Ubicaciones</span>
                <h2>🏛️ Gestión de Espacios Físicos</h2>
                <p style={{ color: '#5f5e5e', margin: '0.5rem 0 0' }}>Crea, edita o elimina salones y consulta ocupación</p>

                {mensaje && (
                    <div className={`mensaje-alerta ${mensaje.tipo}`}>
                        {mensaje.texto}
                    </div>
                )}

                <div className="grid-gestion-espacios">
                    <form onSubmit={guardarEspacio} className="form-crear-espacio">
                        <h4>{editando ? 'Editar Espacio Físico' : 'Crear Nuevo Salón / Pabellón / Estante'}</h4>
                        {esSuperAdmin && eventosActivos.length > 0 && (
                            <div className="campo-formulario">
                                <label>Evento del Espacio</label>
                                <select
                                    value={idEventoSeleccionado}
                                    onChange={(e) => setIdEventoSeleccionado(e.target.value)}
                                    required
                                >
                                    {eventosActivos.map(ev => (
                                        <option key={ev.id_evento} value={ev.id_evento}>
                                            🗓️ {ev.nombre_evento} ({ev.codigo_evento})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="campo-formulario">
                            <label>Nombre del Espacio</label>
                            <input type="text" value={nombreEspacio} onChange={(e) => setNombreEspacio(e.target.value)} required placeholder="Ej. Salón 101 - Pabellón A" />
                        </div>
                        <div className="campo-formulario">
                            <label>Capacidad Máxima de Pósters</label>
                            <input type="number" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} required min="1" placeholder="Ej. 10" />
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button type="submit" className="boton-primario">
                                {editando ? 'Guardar Cambios' : 'Guardar Espacio Físico'}
                            </button>
                            {editando && (
                                <button type="button" className="boton-secundario" onClick={resetFormulario}>
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="tabla-espacios-container">
                        <h4>Listado de Espacios Actuales</h4>
                        <div className="contenedor-tabla">
                          <HintScrollTabla />
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        {esSuperAdmin && <th>Evento</th>}
                                        <th>Capacidad</th>
                                        <th>Ocupados</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {espacios.length === 0 ? (
                                        <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '15px', color: '#666' }}>No hay espacios registrados</td></tr>
                                    ) : (
                                        espacios.map(esp => (
                                            <tr key={esp.id_espacio}>
                                                <td>{esp.nombre_espacio}</td>
                                                {esSuperAdmin && <td>{esp.nombre_evento || `Evento #${esp.id_evento}`}</td>}
                                                <td>{esp.capacidad}</td>
                                                <td>{esp.ocupacion_actual !== undefined ? esp.ocupacion_actual : (esp.ocupados || 0)}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-accion-tabla"
                                                        title="Editar espacio"
                                                        onClick={() => iniciarEdicion(esp)}
                                                        style={{ marginRight: 6 }}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-accion-tabla"
                                                        title="Eliminar espacio"
                                                        onClick={() => eliminarEspacio(esp)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GestionEspaciosModal;
