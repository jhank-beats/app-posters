import React, { useState, useEffect } from 'react';
import '../generales/roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const EvaluacionPosters = ({ poster, idEvaluador, cerrarModal, alGuardar }) => {
    // Estados inicializados estrictamente en 1 por defecto
    const [contenido, setContenido] = useState(1);
    const [diseno, setDiseno] = useState(1);
    const [exposicion, setExposicion] = useState(1);
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

                // Mapeo seguro: si la BD trae null, 0 o algo menor a 1, se fuerza a 1
                const valContenido = parseFloat(evalExistente.calificacion_contenido);
                const valDiseno = parseFloat(evalExistente.calificacion_diseño);
                const valExposicion = parseFloat(evalExistente.calificacion_exposicion);

                setContenido(!isNaN(valContenido) && valContenido >= 1 ? valContenido : 1);
                setDiseno(!isNaN(valDiseno) && valDiseno >= 1 ? valDiseno : 1);
                setExposicion(!isNaN(valExposicion) && valExposicion >= 1 ? valExposicion : 1);
                setObservaciones(evalExistente.observaciones || '');
            }
        } catch (error) {
            console.error("Error al obtener evaluación previa:", error);
        }
    };

    const calcularPromedio = () => {
        const c = parseFloat(contenido) || 1;
        const d = parseFloat(diseno) || 1;
        const e = parseFloat(exposicion) || 1;
        return ((c + d + e) / 3).toFixed(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje(null);

        const c = parseFloat(contenido);
        const d = parseFloat(diseno);
        const exp = parseFloat(exposicion);

        // Validaciones estrictas con aviso específico si algún criterio es menor a 1 o mayor a 5
        if (isNaN(c) || c < 1 || c > 5) {
            setMensaje({ tipo: 'error', texto: 'El criterio de Contenido no es válido. La nota mínima es 1 y la máxima es 5.' });
            return;
        }
        if (isNaN(d) || d < 1 || d > 5) {
            setMensaje({ tipo: 'error', texto: 'El criterio de Diseño está en un valor no válido (menor a 1 o en 0). La nota mínima es 1.' });
            return;
        }
        if (isNaN(exp) || exp < 1 || exp > 5) {
            setMensaje({ tipo: 'error', texto: 'El criterio de Exposición no es válido. La nota mínima es 1 y la máxima es 5.' });
            return;
        }

        setCargando(true);

        const payload = {
            id_poster: poster.id,
            id_evaluador: idEvaluador,
            calificacion_contenido: c,
            calificacion_diseño: d,
            calificacion_exposicion: exp,
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
        } catch {
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
                        <label>Calificación de Contenido (1.0 - 5.0):</label>
                        <input
                            type="number"
                            min="1"
                            max="5"
                            step="0.1"
                            value={contenido}
                            onChange={(e) => setContenido(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grupo-input">
                        <label>Calificación de Diseño (1.0 - 5.0):</label>
                        <input
                            type="number"
                            min="1"
                            max="5"
                            step="0.1"
                            value={diseno}
                            onChange={(e) => setDiseno(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grupo-input">
                        <label>Calificación de Exposición (1.0 - 5.0):</label>
                        <input
                            type="number"
                            min="1"
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