import React, { useState, useEffect } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const AsignarEspacioModal = ({ poster, cerrarModal, alActualizar }) => {
    const [espacios, setEspacios] = useState([]);
    const [idEspacioSeleccionado, setIdEspacioSeleccionado] = useState(poster?.id_espacio || '');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        cargarEspacios();
    }, []);

    const cargarEspacios = async () => {
        try {
            const qs = poster?.id_evento ? `?id_evento=${encodeURIComponent(poster.id_evento)}` : '';
            const res = await fetch(`${SERVER_URL}/api/Espacios.php${qs}`);
            const data = await res.json();

            // Verificamos ambas opciones (success booleano o status 'success')
            if (data.success || data.status === 'success') {
                setEspacios(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar espacios físicos:", error);
        }
    };

    const handleAsignar = async (e) => {
        e.preventDefault();
        setCargando(true);
        setMensaje(null);

        try {
            const res = await fetch(`${SERVER_URL}/api/Espacios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'asignar_poster',
                    id_poster: poster.id || poster.id_poster,
                    id_espacio: idEspacioSeleccionado
                })
            });

            const data = await res.json();

            if (data.success || data.status === 'success') {
                setMensaje({ tipo: 'exito', texto: 'Ubicación física asignada correctamente' });
                setTimeout(() => {
                    alActualizar();
                    cerrarModal();
                }, 1000);
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'Error al asignar espacio' });
            }
        } catch {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="modal-overlay-asignar" onClick={cerrarModal}>
            <div className="modal-contenido-asignar" onClick={(e) => e.stopPropagation()}>
                <button className="cerrar-modal" onClick={cerrarModal}>×</button>

                <h2>📍 Asignar Espacio Físico</h2>

                {poster && (
                    <div className="poster-info-box">
                        <p><strong>Póster:</strong> {poster.titulo}</p>
                        <p>
                            <strong>Ubicación actual:</strong>{' '}
                            {poster.nombre_espacio
                                ? `${poster.nombre_espacio}${poster.ubicacion_detallada ? ` #${poster.ubicacion_detallada}` : ''}`
                                : 'Sin asignar'}
                        </p>
                    </div>
                )}

                {mensaje && (
                    <div className={`mensaje-alerta ${mensaje.tipo}`}>
                        {mensaje.texto}
                    </div>
                )}

                <form onSubmit={handleAsignar}>
                    <div className="form-group-asignar">
                        <label>Seleccionar Espacio Físico:</label>
                        <select
                            value={idEspacioSeleccionado}
                            onChange={(e) => setIdEspacioSeleccionado(e.target.value)}
                            required
                        >
                            <option value="">-- Seleccionar ubicación --</option>
                            {espacios.map((espacio) => {
                                // Cambia esta línea en tu AsignarEspacioModal.jsx:
                                const ocupados = espacio.ocupados || espacio.ocupacion_actual || 0;
                                const lleno = ocupados >= espacio.capacidad && espacio.id_espacio != poster?.id_espacio;
                                return (
                                    <option
                                        key={espacio.id_espacio}
                                        value={espacio.id_espacio}
                                        disabled={lleno}
                                    >
                                        {espacio.nombre_espacio} ({ocupados}/{espacio.capacidad} ocupados) {lleno ? '- LLENO' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="modal-botones-acciones">
                        <button type="button" className="btn-cancelar" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={cargando || !idEspacioSeleccionado}
                            className="btn-guardar"
                        >
                            {cargando ? 'Guardando...' : 'Guardar Ubicación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AsignarEspacioModal; 