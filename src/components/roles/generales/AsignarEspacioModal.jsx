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
            const res = await fetch(`${SERVER_URL}/api/Espacios.php`);
            const data = await res.json();
            if (data.success) {
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'asignar_poster',
                    id_poster: poster.id,
                    id_espacio: idEspacioSeleccionado
                })
            });

            const data = await res.json();

            if (data.success) {
                setMensaje({ tipo: 'exito', texto: 'Ubicación física asignada correctamente' });
                setTimeout(() => {
                    alActualizar();
                    cerrarModal();
                }, 1200);
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'Error al asignar espacio' });
            }
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="modal-imagen" onClick={cerrarModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', padding: '20px' }}>
                <button className="cerrar-modal" onClick={cerrarModal}>×</button>

                <h2>📍 Asignar Espacio Físico</h2>

                {poster && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '5px', borderLeft: '4px solid #0056b3' }}>
                        <p><strong>Póster:</strong> {poster.titulo}</p>
                        <p><strong>Categoría:</strong> {poster.categoria}</p>
                        <p><strong>Ubicación actual:</strong> {poster.nombre_espacio || 'Sin asignar'}</p>
                    </div>
                )}

                {mensaje && (
                    <div className={`alerta ${mensaje.tipo === 'exito' ? 'alerta-exito' : 'alerta-error'}`} style={{ marginBottom: '10px' }}>
                        {mensaje.texto}
                    </div>
                )}

                <form onSubmit={handleAsignar}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                            Seleccionar Espacio Físico / Pabellón / Estante:
                        </label>
                        <select
                            value={idEspacioSeleccionado}
                            onChange={(e) => setIdEspacioSeleccionado(e.target.value)}
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                            <option value="">-- Seleccionar ubicación --</option>
                            {espacios.map((espacio) => {
                                const lleno = espacio.ocupados >= espacio.capacidad && espacio.id_espacio != poster.id_espacio;
                                return (
                                    <option
                                        key={espacio.id_espacio}
                                        value={espacio.id_espacio}
                                        disabled={lleno}
                                    >
                                        {espacio.nombre_espacio} ({espacio.ocupados}/{espacio.capacidad} ocupados) {lleno ? '- LLENO' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" onClick={cerrarModal} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={cargando || !idEspacioSeleccionado}
                            style={{ padding: '8px 16px', background: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
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