import React, { useState, useEffect } from 'react';
import { categoriaLegible } from '../../../categorias.js';
import '../generales/Evaluar.css';
import { API_BASE } from '../../../config.js';

// Usar la misma constante dinámica que en MostrarPostersAdmin.jsx

const AsignarEvaluadorModal = ({ poster, cerrarModal, idRonda = null }) => {
    const [evaluadores, setEvaluadores] = useState([]);
    const [filtroEspecialidad, setFiltroEspecialidad] = useState('');
    const [seleccionados, setSeleccionados] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState(null);
    const [profesoresExcluidos, setProfesoresExcluidos] = useState([]);
    // Contexto de ronda: en la Ronda 1 solo cabe UN evaluador (radio);
    // desde la Ronda 2 pueden ser varios (checkbox con tope).
    const [rondaCtx, setRondaCtx] = useState({ id_ronda: 0, numero: 0, limite: 1 });
    const [idAutorPoster, setIdAutorPoster] = useState(() => Number(poster?.id_usuario || 0));
    const soloUno = Number(rondaCtx.limite || 1) === 1;

    useEffect(() => {
        if (poster && poster.id) {
            setIdAutorPoster(Number(poster.id_usuario || 0));
            cargarEvaluadores();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtroEspecialidad, poster?.id]);

    const cargarEvaluadores = async () => {
        try {
            setCargando(true);
            const params = `id_poster=${poster.id}&carrera=${encodeURIComponent(filtroEspecialidad)}`;
            const url = `${API_BASE}/AsignarEvaluadores.php?${params}${idRonda ? `&id_ronda=${idRonda}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                const autorId = Number(data.id_autor || poster?.id_usuario || 0);
                if (autorId > 0) setIdAutorPoster(autorId);
                setProfesoresExcluidos(Array.isArray(data.profesores_excluidos) ? data.profesores_excluidos : []);

                // Fase 3: ocultar autor y profesores (el backend ya los excluye)
                const profeIds = new Set((data.ids_profesores || []).map(Number));
                const listaFiltrada = (data.data || []).filter(
                    e => Number(e.id) !== autorId && !profeIds.has(Number(e.id))
                );
                setEvaluadores(listaFiltrada);
                if (data.ronda) setRondaCtx(data.ronda);
                const yaAsignados = listaFiltrada.filter(e => e.asignado).map(e => e.id);
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
        if (idAutorPoster > 0 && Number(idEvaluador) === idAutorPoster) {
            setMensaje({ tipo: 'error', texto: 'El autor del póster no puede evaluarse a sí mismo.' });
            return;
        }
        const limite = Number(rondaCtx.limite || 1);
        if (soloUno) {
            // Selección única (Ronda 1): elegir a uno deselecciona al anterior.
            setSeleccionados(prev => (prev.includes(idEvaluador) ? [] : [idEvaluador]));
            return;
        }
        setSeleccionados(prev => {
            if (prev.includes(idEvaluador)) return prev.filter(id => id !== idEvaluador);
            if (prev.length >= limite) {
                setMensaje({ tipo: 'error', texto: `Como máximo ${limite} evaluadores por póster en esta ronda. Quita uno antes de agregar otro.` });
                return prev;
            }
            return [...prev, idEvaluador];
        });
    };

    const guardarAsignacion = async () => {
        if (idAutorPoster > 0 && seleccionados.some(id => Number(id) === idAutorPoster)) {
            setMensaje({ tipo: 'error', texto: 'No se puede asignar al autor del póster como su propio evaluador.' });
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/AsignarEvaluadores.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_poster: poster.id,
                    evaluadores_ids: seleccionados,
                    ...(rondaCtx.id_ronda ? { id_ronda: rondaCtx.id_ronda } : {})
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
                    <p><strong>Categoría/Área:</strong> {categoriaLegible(poster.categoria)}</p>
                    {(poster.nombre_usuario || poster.autores) && (
                        <p>
                            <strong>Autor registrado:</strong> {poster.nombre_usuario || poster.autores}{' '}
                            <small style={{ color: '#5f5e5e' }}>(excluido de evaluadores por no autoevaluación)</small>
                        </p>
                    )}
                    {rondaCtx.numero > 0 && (
                        <p>
                            <strong>Ronda:</strong> {rondaCtx.numero}
                            {soloUno
                                ? ' — regla: en la Ronda 1 solo puede haber UN evaluador por póster.'
                                : ` — pueden evaluarse hasta ${rondaCtx.limite} evaluadores por póster.`}
                        </p>
                    )}
                    {profesoresExcluidos.length > 0 && (
                        <p>
                            <strong>Profesores del póster (excluidos):</strong>{' '}
                            {profesoresExcluidos.map(p => p.nombre).join(', ')}
                            {' '}<small style={{ color: '#8a5a00' }}>(conflicto de intereses)</small>
                        </p>
                    )}
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
                        <p style={{ color: '#8a5a00' }}>
                            No hay evaluadores disponibles distintos al autor o a los profesores asignados
                            (conflicto de intereses). No se puede autoasignar.
                        </p>
                    ) : (
                        evaluadores.map(e => (
                            <label key={e.id} className="item-evaluador">
                                <input
                                    type={soloUno ? 'radio' : 'checkbox'}
                                    name={soloUno ? `evaluador-poster-${poster.id}` : undefined}
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

                <p style={{ marginTop: '10px', fontSize: '13px', color: '#5f5e5e' }}>
                    Evaluadores seleccionados: <strong>{seleccionados.length}</strong>
                    {!soloUno && ` / ${rondaCtx.limite}`}
                </p>

                <div className="modal-acciones">
                    <button className="btn-cancelar" onClick={cerrarModal}>Cancelar</button>
                    <button className="btn-guardar" onClick={guardarAsignacion}>Guardar Asignaciones</button>
                </div>
            </div>
        </div>
    );
};

export default AsignarEvaluadorModal;