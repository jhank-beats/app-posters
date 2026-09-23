import React, { useState, useEffect } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const DetallesCalificacionModal = ({ poster, evaluacion, criterios: criteriosProp = [], cerrarModal }) => {
    const [criteriosLocales, setCriteriosLocales] = useState([]);
    const [loadingCriterios, setLoadingCriterios] = useState(false);

    useEffect(() => {
        // Solo fetch si no se enviaron criterios desde el componente padre
        if (!criteriosProp || criteriosProp.length === 0) {
            let isMounted = true;
            const cargarCriterios = async () => {
                try {
                    setLoadingCriterios(true);
                    const res = await fetch(`${SERVER_URL}/api/Criterios.php`);
                    const data = await res.json();
                    if (data.success && isMounted) {
                        setCriteriosLocales(data.data || []);
                    }
                } catch (err) {
                    console.error('Error al cargar la lista de criterios:', err);
                } finally {
                    if (isMounted) setLoadingCriterios(false);
                }
            };
            cargarCriterios();
            return () => { isMounted = false; };
        }
    }, []); // Array de dependencias vacío para ejecutar solo 1 vez al montar el modal

    if (!evaluacion) return null;

    // Usar los props si existen, de lo contrario usar los que cargó la API localmente
    const listaCriterios = criteriosProp.length > 0 ? criteriosProp : criteriosLocales;

    const notasObj = evaluacion.evaluaciones || {};

    // Extracción de valores de nota para el promedio
    const listaNotas = Object.values(notasObj).map(v => parseFloat(v)).filter(v => !isNaN(v));

    // Cálculo del promedio total
    const promedioTotal = listaNotas.length > 0
        ? (listaNotas.reduce((acc, curr) => acc + curr, 0) / listaNotas.length).toFixed(2)
        : '0.00';

    return (
        <div className="modal">
            <section className="formularios todos-pendientes" style={{ maxWidth: '600px', margin: 'auto' }}>
                <button
                    className='cerrar-formulario cerrar-tabla'
                    onClick={cerrarModal}
                >
                    X
                </button>

                <h2>📊 Detalles de Evaluación</h2>
                <p>Revisa la calificación obtenida en los diferentes criterios y las observaciones del evaluador.</p>

                {poster && (
                    <div style={{ marginBottom: '15px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'left' }}>
                        <p style={{ margin: '0 0 5px 0' }}><strong>Póster:</strong> {poster.titulo}</p>
                        <p style={{ margin: 0 }}><strong>Evaluador:</strong> {evaluacion.nombre_evaluador || 'Asignado'}</p>
                    </div>
                )}

                <div className="contenedor-formulario" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {loadingCriterios ? (
                        <p style={{ textAlign: 'center', color: '#666' }}>Cargando criterios...</p>
                    ) : (
                        listaCriterios.length > 0 ? (
                            listaCriterios.map(crit => (
                                <div key={crit.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f1f1f1', borderRadius: '8px' }}>
                                    <span><strong>{crit.nombre}:</strong></span>
                                    <strong>{notasObj[crit.id] !== undefined ? `${parseFloat(notasObj[crit.id]).toFixed(1)} / 5.0` : '0.0 / 5.0'}</strong>
                                </div>
                            ))
                        ) : (
                            Object.entries(notasObj).map(([idCrit, nota]) => (
                                <div key={idCrit} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f1f1f1', borderRadius: '8px' }}>
                                    <span><strong>Criterio #{idCrit}:</strong></span>
                                    <strong>{parseFloat(nota).toFixed(1)} / 5.0</strong>
                                </div>
                            ))
                        )
                    )}

                    {/* Promedio Total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#e2e8f0', borderRadius: '8px', fontSize: '1.1em' }}>
                        <span><strong>Promedio Total:</strong></span>
                        <strong style={{ color: '#0056b3' }}>{promedioTotal} / 5.0</strong>
                    </div>

                    <div style={{ marginTop: '5px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Observaciones del Evaluador:</label>
                        <div style={{ padding: '12px', background: '#fff', border: '1px solid #ccc', borderRadius: '8px', minHeight: '70px', fontSize: '0.95em', color: '#333' }}>
                            {evaluacion.observaciones || 'Sin observaciones registradas.'}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="solicitar-registro"
                        onClick={cerrarModal}
                        style={{ marginTop: '15px', backgroundColor: '#80ba27', border: 'none', cursor: 'pointer' }}
                    >
                        Cerrar
                    </button>
                </div>
            </section>
        </div>
    );
};

export default DetallesCalificacionModal;