import React, { useState, useEffect } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const GestionEspaciosModal = ({ cerrarModal }) => {
    const [espacios, setEspacios] = useState([]);
    const [eventosActivos, setEventosActivos] = useState([]);
    const [idEventoSeleccionado, setIdEventoSeleccionado] = useState('');
    const [nombreEspacio, setNombreEspacio] = useState('');
    const [capacidad, setCapacidad] = useState('');
    const [mensaje, setMensaje] = useState(null);

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
            const res = await fetch(`${SERVER_URL}/api/Eventos.php?activo=1`);
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
            const res = await fetch(`${SERVER_URL}/api/Espacios.php`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEspacios(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar espacios:", error);
        }
    };

    const crearEspacio = async (e) => {
        e.preventDefault();
        setMensaje(null);
        if (!nombreEspacio.trim() || !capacidad) {
            setMensaje({ tipo: 'error', texto: 'Por favor complete todos los campos' });
            return;
        }
        try {
            const cuerpoPeticion = {
                nombre_espacio: nombreEspacio.trim(),
                capacidad: parseInt(capacidad, 10),
                ubicacion_detallada: ""
            };
            if (esSuperAdmin && idEventoSeleccionado) {
                cuerpoPeticion.id_evento = parseInt(idEventoSeleccionado, 10);
            }
            const res = await fetch(`${SERVER_URL}/api/Espacios.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(cuerpoPeticion)
            });
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
                setMensaje({ tipo: 'exito', texto: 'Espacio físico creado exitosamente' });
                setNombreEspacio('');
                setCapacidad('');
                cargarEspacios();
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'Error al crear espacio' });
            }
        } catch (error) {
            console.error("Error de red:", error);
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        }
    };

    return (
        <div className="modal">
            <div className="modal-espacios-contenido">
                <button className="cerrar-modal" onClick={cerrarModal} aria-label="Cerrar">×</button>
                <span className="seccion-eyebrow">Ubicaciones</span>
                <h2>🏛️ Gestión de Espacios Físicos</h2>
                <p style={{ color: '#5f5e5e', margin: '0.5rem 0 0' }}>Crea salones y consulta ocupación</p>

                {mensaje && (
                    <div className={`mensaje-alerta ${mensaje.tipo}`}>
                        {mensaje.texto}
                    </div>
                )}

                <div className="grid-gestion-espacios">
                    <form onSubmit={crearEspacio} className="form-crear-espacio">
                        <h4>Crear Nuevo Salón / Pabellón / Estante</h4>
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
                        <button type="submit" className="boton-primario">Guardar Espacio Físico</button>
                    </form>

                    <div className="tabla-espacios-container">
                        <h4>Listado de Espacios Actuales</h4>
                        <div className="contenedor-tabla">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        {esSuperAdmin && <th>Evento</th>}
                                        <th>Capacidad</th>
                                        <th>Ocupados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {espacios.length === 0 ? (
                                        <tr><td colSpan={esSuperAdmin ? "4" : "3"} style={{ textAlign: 'center', padding: '15px', color: '#666' }}>No hay espacios registrados</td></tr>
                                    ) : (
                                        espacios.map(esp => (
                                            <tr key={esp.id_espacio}>
                                                <td>{esp.nombre_espacio}</td>
                                                {esSuperAdmin && <td>{esp.nombre_evento || `Evento #${esp.id_evento}`}</td>}
                                                <td>{esp.capacidad}</td>
                                                <td>{esp.ocupacion_actual !== undefined ? esp.ocupacion_actual : (esp.ocupados || 0)}</td>
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
