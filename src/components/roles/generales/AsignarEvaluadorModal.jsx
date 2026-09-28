import React, { useState, useEffect } from 'react';
import '../generales/Evaluar.css';

// Usar la misma constante dinámica que en MostrarPostersAdmin.jsx
const SERVER_URL = `http://${window.location.hostname}:8000`;

const AsignarEvaluadorModal = ({ poster, cerrarModal }) => {
    const [evaluadores, setEvaluadores] = useState([]);
    const [filtroEspecialidad, setFiltroEspecialidad] = useState('');
    const [seleccionados, setSeleccionados] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        if (poster && poster.id) {
            cargarEvaluadores();
        }
    }, [filtroEspecialidad]);

    const cargarEvaluadores = async () => {
        try {
            setCargando(true);
            const url = `${SERVER_URL}/api/AsignarEvaluadores.php?id_poster=${poster.id}&carrera=${encodeURIComponent(filtroEspecialidad)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                setEvaluadores(data.data);
                // Pre-seleccionar evaluadores que ya están asignados a este póster
                const yaAsignados = data.data.filter(e => e.asignado).map(e => e.id);
                setSeleccionados(yaAsignados);
            } else {
                console.error("Error devuelto por la API:", data.message);
            }
        } catch (error) {
            console.error("Error al cargar evaluadores:", error);
        } finally {
            setCargando(false);
        }
    };

    const handleCheckboxChange = (idEvaluador) => {
        if (seleccionados.includes(idEvaluador)) {
            setSeleccionados(seleccionados.filter(id => id !== idEvaluador));
        } else {
            setSeleccionados([...seleccionados, idEvaluador]);
        }
    };

    const guardarAsignacion = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/AsignarEvaluadores.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_poster: poster.id,
                    evaluadores_ids: seleccionados
                })
            });

            const data = await res.json();
            if (data.success) {
                setMensaje({ tipo: 'exito', texto: 'Asignación guardada con éxito' });
                setTimeout(() => cerrarModal(), 1500);
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'Error al guardar la asignación' });
            }
        } catch {
            setMensaje({ tipo: 'error', texto: 'Error al conectar con el servidor PHP' });
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-contenido-evaluador">
                <header className="modal-header">
                    <h2>Asignar Evaluadores al Póster</h2>
                    <button className="btn-cerrar" onClick={cerrarModal}>&times;</button>
                </header>

                <div className="info-poster-resumen">
                    <p><strong>Póster:</strong> {poster.titulo}</p>
                    <p><strong>Categoría/Área:</strong> {poster.categoria}</p>
                </div>

                <div className="filtro-contenedor">
                    <label>Filtrar evaluadores por carrera / área:</label>
                    <input
                        type="text"
                        placeholder="Ej. Ingeniería, Medicina..."
                        value={filtroEspecialidad}
                        onChange={(e) => setFiltroEspecialidad(e.target.value)}
                    />
                </div>

                {mensaje && (
                    <div className={`alerta alerta-${mensaje.tipo}`}>
                        {mensaje.texto}
                    </div>
                )}

                <div className="lista-evaluadores">
                    {cargando ? (
                        <p>Cargando lista de evaluadores...</p>
                    ) : evaluadores.length === 0 ? (
                        <p>No se encontraron evaluadores.</p>
                    ) : (
                        evaluadores.map(e => (
                            <label key={e.id} className="item-evaluador">
                                <input
                                    type="checkbox"
                                    checked={seleccionados.includes(e.id)}
                                    onChange={() => handleCheckboxChange(e.id)}
                                />
                                <div className="datos-evaluador">
                                    <span className="nombre">{e.nombre_completo}</span>
                                    <span className="carrera">{e.carrera || 'Sin especificación'}</span>
                                    <span className="correo">{e.correo}</span>
                                </div>
                            </label>
                        ))
                    )}
                </div>

                <div className="modal-acciones">
                    <button className="btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                    <button className="btn-guardar" onClick={guardarAsignacion}>Guardar Asignaciones</button>
                </div>
            </div>
        </div>
    );
};

export default AsignarEvaluadorModal;