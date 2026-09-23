import React, { useState, useEffect } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const DetallesCalificacionModal = ({ poster, evaluacion, criterios: criteriosProp = [], cerrarModal }) => {
    const [criteriosLocales, setCriteriosLocales] = useState([]);
    const [loadingCriterios, setLoadingCriterios] = useState(false);

    useEffect(() => {
        if (!criteriosProp || criteriosProp.length === 0) {
            let isMounted = true;
            const cargarCriterios = async () => {
                try {
                    setLoadingCriterios(true);
                    const res = await fetch(`${SERVER_URL}/api/Criterios.php`);
                    const data = await res.json();
                    if (data.success && isMounted) setCriteriosLocales(data.data || []);
                } catch (err) {
                    console.error('Error al cargar la lista de criterios:', err);
                } finally {
                    if (isMounted) setLoadingCriterios(false);
                }
            };
            cargarCriterios();
            return () => { isMounted = false; };
        }
    }, []);

    if (!evaluacion) return null;
    const listaCriterios = criteriosProp.length > 0 ? criteriosProp : criteriosLocales;
    const notasObj = evaluacion.evaluaciones || {};
    const listaNotas = Object.values(notasObj).map(v => parseFloat(v)).filter(v => !isNaN(v));
    const promedioTotal = listaNotas.length > 0 ? (listaNotas.reduce((acc, curr) => acc + curr, 0) / listaNotas.length).toFixed(2) : '0.00';

    return (
        <div className="modal">
            <div className="formularios" style={{ maxWidth: '600px' }}>
                <button className='cerrar-formulario' onClick={cerrarModal} aria-label="Cerrar">X</button>
                <div className="formularios-header">
                    <span className="formularios-eyebrow">Calificación</span>
                    <h2>📊 Detalles de Evaluación</h2>
                    <p>Revisa la calificación obtenida y observaciones</p>
                </div>

                {poster && (
                    <div className="poster-info-box" style={{ textAlign: 'left' }}>
                        <p><strong>Póster:</strong> {poster.titulo}</p>
                        <p><strong>Evaluador:</strong> {evaluacion.nombre_evaluador || 'Asignado'}</p>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                    {loadingCriterios ? (
                        <p style={{ textAlign: 'center', color: '#5f5e5e' }}>Cargando criterios...</p>
                    ) : (
                        listaCriterios.length > 0 ? (
                            listaCriterios.map(crit => (
                                <div key={crit.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: '#f5f7f8', borderRadius: '10px', border: '1px solid rgba(19,39,64,0.06)' }}>
                                    <span style={{ fontWeight: 600, color: '#132740' }}>{crit.nombre}</span>
                                    <strong style={{ color: '#00acc9' }}>{notasObj[crit.id] !== undefined ? `${parseFloat(notasObj[crit.id]).toFixed(1)} / 5.0` : '0.0 / 5.0'}</strong>
                                </div>
                            ))
                        ) : (
                            Object.entries(notasObj).map(([idCrit, nota]) => (
                                <div key={idCrit} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: '#f5f7f8', borderRadius: '10px', border: '1px solid rgba(19,39,64,0.06)' }}>
                                    <span style={{ fontWeight: 600 }}>Criterio #{idCrit}</span>
                                    <strong style={{ color: '#00acc9' }}>{parseFloat(nota).toFixed(1)} / 5.0</strong>
                                </div>
                            ))
                        )
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,172,201,0.06)', borderRadius: '12px', border: '1px solid rgba(0,172,201,0.2)' }}>
                        <span style={{ fontWeight: 700, color: '#132740' }}>Promedio Total</span>
                        <strong style={{ color: '#00acc9', fontSize: '1.1rem' }}>{promedioTotal} / 5.0</strong>
                    </div>

                    <div className="campo-formulario">
                        <label>Observaciones del Evaluador</label>
                        <div style={{ padding: '0.85rem 1rem', background: '#ffffff', border: '2px solid #d5ddd3', borderRadius: '10px', minHeight: '70px', color: '#132740' }}>
                            {evaluacion.observaciones || 'Sin observaciones registradas.'}
                        </div>
                    </div>

                    <button type="button" className="boton-primario" onClick={cerrarModal}>Cerrar</button>
                </div>
            </div>
        </div>
    );
};

export default DetallesCalificacionModal;
