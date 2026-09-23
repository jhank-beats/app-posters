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

        // Validar localmente antes de enviar
        if (!nombreEspacio.trim() || !capacidad) {
            setMensaje({ tipo: 'error', texto: 'Por favor complete todos los campos' });
            return;
        }

        try {
            const cuerpoPeticion = {
                nombre_espacio: nombreEspacio.trim(),
                capacidad: parseInt(capacidad, 10),
                ubicacion_detallada: "" // Enviamos un campo extra por si la BD lo exige
            };

            const res = await fetch(`${SERVER_URL}/api/Espacios.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(cuerpoPeticion)
            });

            const textResponse = await res.text(); // Capturamos como texto primero por seguridad
            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (err) {
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
                <button className="cerrar-modal" onClick={cerrarModal}>×</button>

                <h2>🏛️ Gestión de Espacios Físicos</h2>

                {mensaje && (
                    <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', background: mensaje.tipo === 'exito' ? '#d4edda' : '#f8d7da', color: mensaje.tipo === 'exito' ? '#155724' : '#721c24' }}>
                        {mensaje.texto}
                    </div>
                )}

                <div className="grid-gestion-espacios">
                    {/* Formulario de creación */}
                    <form onSubmit={crearEspacio} className="form-crear-espacio">
                        <h4>Crear Nuevo Salón / Pabellón / Estante</h4>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '5px' }}>Nombre del Espacio:</label>
                            <input
                                type="text"
                                value={nombreEspacio}
                                onChange={(e) => setNombreEspacio(e.target.value)}
                                required
                                placeholder="Ej. Salón 101 - Pabellón A"
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '5px' }}>Capacidad Máxima de Pósters:</label>
                            <input
                                type="number"
                                value={capacidad}
                                onChange={(e) => setCapacidad(e.target.value)}
                                required
                                min="1"
                                placeholder="Ej. 10"
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>
                        <button type="submit" style={{ background: '#28a745', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
                            Guardar Espacio Físico
                        </button>
                    </form>

                    {/* Listado de espacios */}
                    <div className="tabla-espacios-container">
                        <h4>Listado de Espacios Actuales</h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '300px' }}>
                                <thead>
                                    <tr style={{ background: '#f1f1f1', textAlign: 'left' }}>
                                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>Nombre</th>
                                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>Capacidad</th>
                                        <th style={{ padding: '8px', border: '1px solid #ddd' }}>Ocupados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {espacios.length === 0 ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '15px', color: '#666' }}>No hay espacios registrados</td></tr>
                                    ) : (
                                        espacios.map(esp => (
                                            <tr key={esp.id_espacio}>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{esp.nombre_espacio}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{esp.capacidad}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{esp.ocupacion_actual !== undefined ? esp.ocupacion_actual : (esp.ocupados || 0)}</td>
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