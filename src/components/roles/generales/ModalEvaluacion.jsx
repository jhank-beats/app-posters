import React, { useState, useEffect } from 'react';
import './Evaluar.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const ModalEvaluacion = ({ poster, criterios, evaluacionInicial, onClose, onGuardado, idEvaluador }) => {
    const [valores, setValores] = useState({});
    const [observaciones, setObservaciones] = useState('');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        const inicial = {};
        criterios.forEach(c => {
            const v = evaluacionInicial?.criterios?.[c.id];
            inicial[c.id] = v !== undefined && v !== null ? parseFloat(v) : 0;
        });
        setValores(inicial);
        setObservaciones(evaluacionInicial?.observaciones || '');
    }, [criterios, evaluacionInicial, poster]);

    const handleValorChange = (idCriterio, valor) => {
        const num = parseFloat(valor);
        setValores(prev => ({ ...prev, [idCriterio]: isNaN(num) ? 0 : num }));
    };

    const calcularPromedio = () => {
        const vals = Object.values(valores);
        if (vals.length === 0) return '0.00';
        const suma = vals.reduce((a, b) => a + (parseFloat(b) || 0), 0);
        return (suma / vals.length).toFixed(2);
    };

    const handleGuardar = async (e) => {
        e.preventDefault();
        // Validar 0-5
        for (const c of criterios) {
            const v = parseFloat(valores[c.id]);
            if (isNaN(v) || v < 0 || v > 5) {
                setMensaje({ tipo: 'error', texto: `Criterio "${c.nombre}" debe estar entre 0 y 5` });
                return;
            }
        }
        setCargando(true);
        setMensaje(null);
        try {
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_poster: poster.id,
                    id_evaluador: idEvaluador,
                    criterios: valores,
                    observaciones
                })
            });
            const data = await res.json();
            if (data.success) {
                setMensaje({ tipo: 'exito', texto: 'Evaluación guardada correctamente' });
                setTimeout(() => { onGuardado(); onClose(); }, 900);
            } else setMensaje({ tipo: 'error', texto: data.message || 'Error al guardar' });
        } catch {
            setMensaje({ tipo: 'error', texto: 'Error de conexión' });
        } finally { setCargando(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-contenido-evaluar" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
                <header className="modal-header">
                    <h2>{evaluacionInicial?.existente ? '✏️ Editar Evaluación' : '⭐ Calificar Póster'}</h2>
                    <button className="btn-cerrar" onClick={onClose} aria-label="Cerrar">×</button>
                </header>

                <div className="info-poster-resumen">
                    <p><strong>Póster:</strong> {poster.titulo}</p>
                    <p><strong>Autores:</strong> {poster.autores}</p>
                    <p><strong>Categoría:</strong> {poster.categoria}</p>
                    {poster.descripcion && <p style={{ marginTop: '6px', fontStyle: 'italic', color: '#5f5e5e' }}>{poster.descripcion.slice(0, 180)}{poster.descripcion.length > 180 ? '...' : ''}</p>}
                </div>

                {mensaje && <div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>}

                <form onSubmit={handleGuardar}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                        {criterios.map(crit => (
                            <div key={crit.id} className="criterio-card" style={{
                                border: '1px solid rgba(19,39,64,0.08)',
                                borderLeft: '4px solid #00acc9',
                                borderRadius: '12px',
                                padding: '1rem 1.1rem',
                                background: '#ffffff',
                                boxShadow: '0 2px 8px rgba(19,39,64,0.06)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: '#132740', fontSize: '0.98rem' }}>{crit.nombre}</div>
                                        {crit.descripcion && <div style={{ fontSize: '0.85rem', color: '#5f5e5e', marginTop: '0.3rem', lineHeight: 1.4 }}>{crit.descripcion}</div>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                        <input
                                            type="number"
                                            min="0" max="5" step="0.1"
                                            value={valores[crit.id] ?? 0}
                                            onChange={e => handleValorChange(crit.id, e.target.value)}
                                            style={{
                                                width: '78px',
                                                padding: '0.65rem 0.6rem',
                                                border: '2px solid #d5ddd3',
                                                borderRadius: '10px',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                color: '#132740'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.85rem', color: '#5f5e5e' }}>/ 5</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="resumen-promedio">
                        <span>Promedio actual</span>
                        <span className="nota-promedio">{calcularPromedio()} / 5.0</span>
                    </div>

                    <div className="campo-observaciones">
                        <label>Observaciones / Comentarios</label>
                        <textarea
                            rows="4"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            placeholder="Escribe feedback constructivo para los autores..."
                        />
                    </div>

                    <div className="modal-acciones">
                        <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-guardar" disabled={cargando}>{cargando ? 'Guardando...' : evaluacionInicial?.existente ? 'Guardar Cambios' : 'Guardar Calificación'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalEvaluacion;
