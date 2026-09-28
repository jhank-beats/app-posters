import React, { useState, useEffect } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const GestionEspaciosModal = ({ cerrarModal }) => {
    const [espacios, setEspacios] = useState([]);
    const [nombreEspacio, setNombreEspacio] = useState('');
    const [capacidad, setCapacidad] = useState('');
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        cargarEspacios();
    }, []);

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
                                        <th>Capacidad</th>
                                        <th>Ocupados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {espacios.length === 0 ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '15px', color: '#666' }}>No hay espacios registrados</td></tr>
                                    ) : (
                                        espacios.map(esp => (
                                            <tr key={esp.id_espacio}>
                                                <td>{esp.nombre_espacio}</td>
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
