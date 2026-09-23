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
        if (poster?.id && idEvaluador) cargarEvaluacionExistente();
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
        const payload = { id_poster: poster.id, id_evaluador: idEvaluador, calificacion_contenido: parseFloat(contenido), calificacion_diseno: parseFloat(diseno), calificacion_exposicion: parseFloat(exposicion), observaciones };
        try {
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.success) {
                setMensaje({ tipo: 'exito', texto: 'Evaluación guardada correctamente' });
                setTimeout(() => cerrarModal(), 1200);
            } else setMensaje({ tipo: 'error', texto: data.message || 'Error al guardar calificación' });
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor' });
        } finally { setCargando(false); }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-contenido-evaluar">
                <header className="modal-header">
                    <h2>Calificar Póster</h2>
                    <button className="btn-cerrar" onClick={cerrarModal} aria-label="Cerrar">×</button>
                </header>

                {poster && (
                    <div className="info-poster-resumen">
                        <p><strong>Título:</strong> {poster.titulo}</p>
                        <p><strong>Autores:</strong> {poster.autores}</p>
                        <p><strong>Categoría:</strong> {poster.categoria}</p>
                    </div>
                )}

                {mensaje && (<div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>)}

                <form onSubmit={handleSubmit}>
                    <div className="campo-formulario">
                        <label>Contenido (0.0 - 5.0)</label>
                        <input type="number" min="0" max="5" step="0.1" value={contenido} onChange={(e) => setContenido(e.target.value)} required />
                    </div>
                    <div className="campo-formulario">
                        <label>Diseño (0.0 - 5.0)</label>
                        <input type="number" min="0" max="5" step="0.1" value={diseno} onChange={(e) => setDiseno(e.target.value)} required />
                    </div>
                    <div className="campo-formulario">
                        <label>Exposición (0.0 - 5.0)</label>
                        <input type="number" min="0" max="5" step="0.1" value={exposicion} onChange={(e) => setExposicion(e.target.value)} required />
                    </div>

                    <div className="resumen-promedio">
                        <strong>Promedio Calculado:</strong>
                        <span className="nota-promedio">{calcularPromedio()}</span>
                    </div>

                    <div className="campo-observaciones">
                        <label>Observaciones / Comentarios</label>
                        <textarea rows="4" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Comentarios adicionales para los autores..."></textarea>
                    </div>

                    <div className="modal-acciones">
                        <button type="button" className="btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                        <button type="submit" disabled={cargando} className="btn-guardar">{cargando ? 'Guardando...' : 'Guardar Evaluación'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EvaluarPosterModal;
