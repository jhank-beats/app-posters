import React, { useState, useEffect } from 'react';
import './Evaluar.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const ModalEvaluacion = ({ poster, criterios, evaluacionInicial, onClose, onGuardado, idRonda = null, nombreRonda = null, soloLectura = false }) => {
    const [valores, setValores] = useState({});
    const [observaciones, setObservaciones] = useState('');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    // Criterios con nota inválida o sin calificar (se resaltan en rojo)
    const [invalidos, setInvalidos] = useState([]);

    const NOTA_MINIMA = 1;
    const NOTA_MAXIMA = 5;

    useEffect(() => {
        const inicial = {};
        criterios.forEach(c => {
            const v = evaluacionInicial?.criterios?.[c.id];
            if (evaluacionInicial?.existente && v !== undefined && v !== null) {
                inicial[c.id] = String(v);
            } else {
                inicial[c.id] = '';
            }
        });
        setValores(inicial);
        setObservaciones(evaluacionInicial?.observaciones || '');
        setInvalidos([]);
    }, [criterios, evaluacionInicial, poster]);

    const handleValorChange = (idCriterio, valor) => {
        setValores(prev => ({ ...prev, [idCriterio]: valor }));
        // Al escribir en el campo, se quita el resaltado de error
        setInvalidos(prev => prev.filter(id => id !== idCriterio));
    };

    const calcularPromedio = () => {
        // Solo promedia los criterios que ya tienen nota (los vacíos no arrastran el promedio a 0)
        const vals = Object.values(valores)
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        if (vals.length === 0) return '0.00';
        return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    };

    const criteriosCalificados = Object.values(valores).filter(v => v !== '' && !isNaN(parseFloat(v))).length;

    const handleGuardar = async (e) => {
        e.preventDefault();

        if (soloLectura) {
            setMensaje({ tipo: 'error', texto: 'Esta ronda está cerrada: la evaluación solo se puede consultar.' });
            return;
        }

        // Evita guardar vacío si los criterios todavía se están cargando
        if (!criterios || criterios.length === 0) {
            setMensaje({ tipo: 'error', texto: 'No hay criterios de evaluación disponibles todavía. Espera unos segundos y vuelve a intentarlo.' });
            return;
        }

        // Validar nota mínima 1 y máxima 5 en cada criterio
        const fallas = [];
        const idsFallidos = [];
        for (const c of criterios) {
            const raw = valores[c.id];
            const v = parseFloat(raw);
            if (raw === '' || raw === null || raw === undefined || isNaN(v)) {
                fallas.push(`${c.nombre} sin calificar`);
                idsFallidos.push(c.id);
            } else if (v < NOTA_MINIMA || v > NOTA_MAXIMA) {
                fallas.push(`${c.nombre} = ${raw}`);
                idsFallidos.push(c.id);
            }
        }

        if (fallas.length > 0) {
            const lista = fallas.length <= 3
                ? fallas.join(', ')
                : `${fallas.slice(0, 3).join(', ')} y ${fallas.length - 3} criterio/s más`;
            setInvalidos(idsFallidos);
            setMensaje({
                tipo: 'error',
                texto: `No se puede guardar: ${lista}. La nota mínima de cada criterio es ${NOTA_MINIMA}.0 y la máxima es ${NOTA_MAXIMA}.0.`
            });
            return;
        }

        setInvalidos([]);
        setCargando(true);
        setMensaje(null);
        try {
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_poster: poster.id,
                    // La identidad (id_evaluador) la toma el backend del token;
                    // aquí solo se indica la ronda de la evaluación.
                    id_ronda: idRonda || undefined,
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
                    <h2>
                        {soloLectura
                            ? '👁️ Evaluación (solo lectura)'
                            : evaluacionInicial?.existente ? '✏️ Editar Evaluación' : '⭐ Calificar Póster'}
                    </h2>
                    <button className="btn-cerrar" onClick={onClose} aria-label="Cerrar">×</button>
                </header>

                <div className="info-poster-resumen">
                    {nombreRonda && (
                        <p>
                            <strong>Ronda:</strong> {nombreRonda}
                            {soloLectura ? ' (cerrada)' : ''}
                        </p>
                    )}
                    <p><strong>Póster:</strong> {poster.titulo}</p>
                    <p><strong>Autores:</strong> {poster.autores}</p>
                    {poster.nombre_evento && (
                        <p>
                            <strong>Evento:</strong> {poster.nombre_evento}
                            {poster.codigo_evento ? ` (${poster.codigo_evento})` : ''}
                        </p>
                    )}
                    <p><strong>Categoría:</strong> {poster.categoria}</p>
                    {poster.descripcion && <p style={{ marginTop: '6px', fontStyle: 'italic', color: '#5f5e5e' }}>{poster.descripcion.slice(0, 180)}{poster.descripcion.length > 180 ? '...' : ''}</p>}
                </div>

                {mensaje && <div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>}

                <form onSubmit={handleGuardar} noValidate>
                    <p style={{ fontSize: '0.88rem', color: '#5f5e5e', marginBottom: '0.9rem', lineHeight: 1.5 }}>
                        Cada criterio debe tener una nota entre <strong>1.0 y 5.0</strong>. Los que queden sin calificar
                        se marcarán en rojo al intentar guardar.
                    </p>

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
                                            min="1" max="5" step="0.1"
                                            value={valores[crit.id] ?? ''}
                                            onChange={e => handleValorChange(crit.id, e.target.value)}
                                            placeholder="—"
                                            inputMode="decimal"
                                            disabled={soloLectura}
                                            aria-label={`Nota de ${crit.nombre} (mínimo 1, máximo 5)`}
                                            style={{
                                                width: '78px',
                                                padding: '0.65rem 0.6rem',
                                                border: `2px solid ${invalidos.includes(crit.id) ? '#e53935' : '#d5ddd3'}`,
                                                outline: invalidos.includes(crit.id) ? '2px solid rgba(229,57,53,0.25)' : 'none',
                                                borderRadius: '10px',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                color: invalidos.includes(crit.id) ? '#c62828' : '#132740',
                                                background: invalidos.includes(crit.id) ? '#fff5f5' : '#ffffff'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.85rem', color: '#5f5e5e' }}>/ 5</span>
                                    </div>
                                </div>
                                {invalidos.includes(crit.id) && (
                                    <div style={{ fontSize: '0.82rem', color: '#c62828', fontWeight: 700, marginTop: '0.55rem' }}>
                                        ⚠️ Falta calificar este criterio. La nota mínima es 1.0
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="resumen-promedio">
                        <span>Promedio actual ({criteriosCalificados}/{criterios.length} criterios)</span>
                        <span className="nota-promedio">{calcularPromedio()} / 5.0</span>
                    </div>

                    {soloLectura && (
                        <div className="alerta alerta-aviso" style={{ marginTop: '0.75rem' }}>
                            🔒 La ronda está cerrada: esta evaluación se muestra en solo lectura y ya no se puede modificar.
                        </div>
                    )}

                    <div className="campo-observaciones">
                        <label>Observaciones / Comentarios</label>
                        <textarea
                            rows="4"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            placeholder="Escribe feedback constructivo para los autores..."
                            disabled={soloLectura}
                        />
                    </div>

                    <div className="modal-acciones">
                        <button type="button" className="btn-cancelar" onClick={onClose}>{soloLectura ? 'Cerrar' : 'Cancelar'}</button>
                        {!soloLectura && (
                            <button type="submit" className="btn-guardar" disabled={cargando}>{cargando ? 'Guardando...' : evaluacionInicial?.existente ? 'Guardar Cambios' : 'Guardar Calificación'}</button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalEvaluacion;
