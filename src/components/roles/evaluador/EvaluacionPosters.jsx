import React, { useState, useEffect } from 'react';
import '../generales/roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const EvaluacionPosters = ({ poster, idEvaluador, cerrarModal, alGuardar }) => {
    const [contenido, setContenido] = useState(0);
    const [diseno, setDiseno] = useState(0);
    const [exposicion, setExposicion] = useState(0);
    const [observaciones, setObservaciones] = useState('');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    // Cargar evaluación previa si existe
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
                    if (alGuardar) alGuardar();
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
        <div className="modal-overlay">
            <div className="modal-contenido modal-evaluacion">
                <div className="modal-header">
                    <h2>Evaluar Póster</h2>
                    <button className="btn-cerrar" onClick={cerrarModal}>&times;</button>
                </div>

                {poster && (
                    <div className="poster-resumen">
                        <h3>{poster.titulo}</h3>
                        <p><strong>Autores:</strong> {poster.autores}</p>
                        <p><strong>Categoría:</strong> {poster.categoria}</p>
                    </div>
                )}

                {mensaje && (
                    <div className={`alerta ${mensaje.tipo === 'exito' ? 'alerta-exito' : 'alerta-error'}`}>
                        {mensaje.texto}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="form-evaluacion">
                    <div className="grupo-input">
                        <label>Calificación de Contenido (0.0 - 5.0):</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={contenido}
                            onChange={(e) => setContenido(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grupo-input">
                        <label>Calificación de Diseño (0.0 - 5.0):</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={diseno}
                            onChange={(e) => setDiseno(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grupo-input">
                        <label>Calificación de Exposición (0.0 - 5.0):</label>
                        <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={exposicion}
                            onChange={(e) => setExposicion(e.target.value)}
                            required
                        />
                    </div>

                    <div className="promedio-destacado">
                        <strong>Promedio Total: </strong>
                        <span>{calcularPromedio()}</span>
                    </div>

                    <div className="grupo-input">
                        <label>Observaciones / Comentarios:</label>
                        <textarea
                            rows="4"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Añade observaciones para los autores..."
                        ></textarea>
                    </div>

                    <div className="modal-acciones">
                        <button type="button" className="btn-cancelar" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-guardar" disabled={cargando}>
                            {cargando ? 'Guardando...' : 'Guardar Evaluación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EvaluacionPosters;