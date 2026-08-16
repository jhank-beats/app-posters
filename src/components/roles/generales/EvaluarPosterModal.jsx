import React, { useState, useEffect } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const EvaluarPosterModal = ({ poster, idEvaluador, cerrarModal }) => {
    const [contenido, setContenido] = useState(0);
    const [diseno, setDiseno] = useState(0);
    const [exposicion, setExposicion] = useState(0);
    const [observaciones, setObservaciones] = useState('');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        if (poster?.id && idEvaluador) {
            cargarEvaluacionExistente();
        }
    }, [poster, idEvaluador]);

    const cargarEvaluacionExistente = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php?id_poster=${poster.id}&id_evaluador=${idEvaluador}`);
            const data = await res.json();

            if (data.success && data.data && data.data.length > 0) {
                const evalExistente = data.data[0];
                setContenido(parseFloat(evalExistente.calificacion_contenido) || 0);
                setDiseno(parseFloat(evalExistente.calificacion_diseno) || 0);
                setExposicion(parseFloat(evalExistente.calificacion_exposicion) || 0);
                setObservaciones(evalExistente.observaciones || '');
            }
        } catch (error) {
            console.error("Error al obtener evaluación previa:", error);
        }
    };

    const calcularPromedio = () => {
        const c = parseFloat(contenido) || 0;
        const d = parseFloat(diseno) || 0;
        const e = parseFloat(exposicion) || 0;
        return ((c + d + e) / 3).toFixed(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setCargando(true);
        setMensaje(null);

        const payload = {
            id_poster: poster.id,
            id_evaluador: idEvaluador,
            calificacion_contenido: parseFloat(contenido),
            calificacion_diseno: parseFloat(diseno),
            calificacion_exposicion: parseFloat(exposicion),
            observaciones: observaciones
        };

        try {
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                setMensaje({ tipo: 'exito', texto: 'Evaluación guardada correctamente' });
                setTimeout(() => {
                    cerrarModal();
                }, 1200);
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'Error al guardar calificación' });
            }
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="modal-imagen" onClick={cerrarModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', padding: '20px' }}>
                <button className="cerrar-modal" onClick={cerrarModal}>×</button>

                <h2>Calificar Póster</h2>

                {poster && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '5px' }}>
                        <p><strong>Título:</strong> {poster.titulo}</p>
                        <p><strong>Autores:</strong> {poster.autores}</p>
                        <p><strong>Categoría:</strong> {poster.categoria}</p>
                    </div>
                )}

                {mensaje && (
                    <div className={`alerta ${mensaje.tipo === 'exito' ? 'alerta-exito' : 'alerta-error'}`} style={{ marginBottom: '10px' }}>
                        {mensaje.texto}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Contenido (0.0 - 5.0):</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={contenido}
                            onChange={(e) => setContenido(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Diseño (0.0 - 5.0):</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={diseno}
                            onChange={(e) => setDiseno(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Exposición (0.0 - 5.0):</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={exposicion}
                            onChange={(e) => setExposicion(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                        />
                    </div>

                    <div style={{ margin: '15px 0', fontSize: '1.1em' }}>
                        <strong>Promedio Calculado: </strong>
                        <span style={{ color: '#0056b3', fontWeight: 'bold' }}>{calcularPromedio()}</span>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Observaciones / Comentarios:</label>
                        <textarea
                            rows="4"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Comentarios adicionales para los autores..."
                            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                        ></textarea>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" onClick={cerrarModal} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={cargando} style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            {cargando ? 'Guardando...' : 'Guardar Evaluación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EvaluarPosterModal;