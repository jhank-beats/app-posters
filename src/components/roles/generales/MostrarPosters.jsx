import React, { useState, useEffect } from 'react';
import "./roles.css";
import AsignarEvaluadorModal from '../generales/AsignarEvaluadorModal.jsx';
import DetallesCalificacionModal from './DetallesCalificacionModal.jsx';
import ModalEvaluacion from './ModalEvaluacion.jsx';
import TarjetaPosterQR from './TarjetaPosterQR.jsx';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const construirUrlArchivo = (rutaImagen) => {
    if (!rutaImagen) return null;
    const nombreArchivo = rutaImagen.split('/').pop();
    return `${SERVER_URL}/imgPosters/${encodeURIComponent(nombreArchivo)}`;
};

const MostrarPosters = ({ cerrarTabla, limite = null, verMas, soloMisPosters = false, soloAsignados = false, idEvaluador = null }) => {
    const [posters, setPosters] = useState([]);
    const [criterios, setCriterios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
    const [filtro, setFiltro] = useState("");

    // Estados de evaluaciones para evaluadores
    const [evaluacionesMap, setEvaluacionesMap] = useState({});

    // Estado de evaluaciones públicas/recibidas para usuarios
    const [calificacionesUsuarioMap, setCalificacionesUsuarioMap] = useState({});
    const [modalDetalleEval, setModalDetalleEval] = useState(null);

    // Modal asignación admin
    const [posterAAsignar, setPosterAAsignar] = useState(null);

    // Modal código QR
    const [posterParaQR, setPosterParaQR] = useState(null);
    const [posterAEvaluar, setPosterAEvaluar] = useState(null);

    // Contexto de usuario
    const [rolUsuario, setRolUsuario] = useState("");
    const [idUsuarioActual, setIdUsuarioActual] = useState(null);

    useEffect(() => {
        const rol = localStorage.getItem("rol") || localStorage.getItem("rolUsuario") || "";
        const idUsr = idEvaluador || localStorage.getItem("idUsuario") || localStorage.getItem("id_usuario");
        setRolUsuario(rol);
        setIdUsuarioActual(idUsr);
    }, [idEvaluador]);

    useEffect(() => {
        cargarCriteriosYPosters();
    }, [soloMisPosters, soloAsignados, idEvaluador]);

    const cargarCriteriosYPosters = async () => {
        try {
            setLoading(true);

            const rol = localStorage.getItem("rol") || localStorage.getItem("rolUsuario") || "";
            const idUsr = idEvaluador || localStorage.getItem("idUsuario") || localStorage.getItem("id_usuario");

            // 1. Cargar la lista de Criterios Dinámicos
            let listaCriterios = [];
            try {
                const resCrit = await fetch(`${SERVER_URL}/api/Criterios.php`);
                const dataCrit = await resCrit.json();
                if (dataCrit.success) {
                    listaCriterios = dataCrit.data || [];
                    setCriterios(listaCriterios);
                }
            } catch (err) {
                console.error('Error al cargar criterios:', err);
            }

            // 2. Cargar Lista de Pósters
            let url = `${SERVER_URL}/api/TablaPosters.php`;
            const params = [];

            if (soloMisPosters && idUsr) {
                params.push(`id_usuario=${idUsr}`);
            }

            if ((soloAsignados || rol.toLowerCase() === 'evaluador') && idUsr) {
                params.push(`id_evaluador=${idUsr}`);
            }

            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            const respuesta = await fetch(url);
            const datos = await respuesta.json();

            if (datos.success) {
                const listaPosters = datos.data || [];
                setPosters(listaPosters);

                if (rol.toLowerCase() === 'evaluador' || soloAsignados) {
                    cargarEvaluacionesParaPosters(listaPosters, listaCriterios, idUsr);
                } else {
                    cargarCalificacionesRecibidas(listaPosters);
                }
            }
        } catch (error) {
            console.error('Error general al cargar los pósters:', error);
        } finally {
            setLoading(false);
        }
    };

    const cargarCalificacionesRecibidas = async (listaPosters) => {
        const mapaCalificaciones = {};
        for (const p of listaPosters) {
            try {
                const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php?id_poster=${p.id}`);
                const data = await res.json();
                if (data.success && (data.evaluaciones || data.data)) {
                    mapaCalificaciones[p.id] = data;
                }
            } catch (err) {
                console.error(`Error al consultar calificación del póster ${p.id}`, err);
            }
        }
        setCalificacionesUsuarioMap(mapaCalificaciones);
    };

    const cargarEvaluacionesParaPosters = async (listaPosters, listaCriterios, idEv) => {
        if (!idEv) return;
        const mapa = {};

        for (const p of listaPosters) {
            try {
                const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php?id_poster=${p.id}&id_evaluador=${idEv}`);
                const data = await res.json();

                const notasCriterios = {};
                if (data.success && data.evaluaciones) {
                    listaCriterios.forEach(c => {
                        const val = parseFloat(data.evaluaciones[c.id]);
                        notasCriterios[c.id] = !isNaN(val) ? val : 0;
                    });

                    mapa[p.id] = {
                        criterios: notasCriterios,
                        observaciones: data.observaciones || '',
                        existente: true,
                        editando: false
                    };
                } else {
                    listaCriterios.forEach(c => { notasCriterios[c.id] = 0; });
                    mapa[p.id] = {
                        criterios: notasCriterios,
                        observaciones: '',
                        existente: false,
                        editando: false
                    };
                }
            } catch (err) {
                console.error(`Error al cargar evaluación del póster ${p.id}`, err);
            }
        }
        setEvaluacionesMap(mapa);
    };

    const calcularPromedioRecibido = (evaluacionData) => {
        if (!evaluacionData) return null;

        const evs = evaluacionData.evaluaciones || evaluacionData.data;
        if (!evs) return null;

        let valores = [];
        if (typeof evs === 'object' && !Array.isArray(evs)) {
            valores = Object.values(evs).map(v => parseFloat(v)).filter(v => !isNaN(v));
        } else if (Array.isArray(evs)) {
            valores = evs.map(e => parseFloat(e.nota || e.calificacion)).filter(v => !isNaN(v));
        }

        if (valores.length === 0) return null;
        const suma = valores.reduce((acc, curr) => acc + curr, 0);
        return (suma / valores.length).toFixed(2);
    };

    const handleCampoEvaluacionChange = (posterId, criterioId, valor) => {
        setEvaluacionesMap(prev => {
            const actual = prev[posterId] || { criterios: {}, observaciones: '', editando: true };
            return {
                ...prev,
                [posterId]: {
                    ...actual,
                    criterios: {
                        ...actual.criterios,
                        [criterioId]: parseFloat(valor) || 0
                    }
                }
            };
        });
    };

    const handleObservacionChange = (posterId, valor) => {
        setEvaluacionesMap(prev => ({
            ...prev,
            [posterId]: { ...prev[posterId], observaciones: valor }
        }));
    };

    const calcularPromedioDinamico = (criteriosObj) => {
        if (!criteriosObj) return '0.00';
        const listaValores = Object.values(criteriosObj);
        if (listaValores.length === 0) return '0.00';
        const suma = listaValores.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        return (suma / listaValores.length).toFixed(2);
    };

    const alternarEditar = (posterId) => {
        setEvaluacionesMap(prev => ({
            ...prev,
            [posterId]: { ...prev[posterId], editando: !prev[posterId]?.editando }
        }));
    };

    const guardarEvaluacionFila = async (posterId) => {
        const ev = evaluacionesMap[posterId];
        if (!ev) return;

        setEvaluacionesMap(prev => ({
            ...prev,
            [posterId]: { ...prev[posterId], guardando: true, mensaje: null }
        }));

        const payload = {
            id_poster: posterId,
            id_evaluador: idUsuarioActual,
            criterios: ev.criterios,
            observaciones: ev.observaciones || ''
        };

        try {
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                setEvaluacionesMap(prev => ({
                    ...prev,
                    [posterId]: {
                        ...prev[posterId],
                        existente: true,
                        editando: false,
                        guardando: false,
                        mensaje: '✓ Guardado'
                    }
                }));
                setTimeout(() => {
                    setEvaluacionesMap(prev => ({
                        ...prev,
                        [posterId]: { ...prev[posterId], mensaje: null }
                    }));
                }, 2000);
            } else {
                alert(data.message || 'Error al guardar la evaluación');
                setEvaluacionesMap(prev => ({
                    ...prev,
                    [posterId]: { ...prev[posterId], guardando: false }
                }));
            }
        } catch (error) {
            alert('Error de conexión al guardar evaluación');
            setEvaluacionesMap(prev => ({
                ...prev,
                [posterId]: { ...prev[posterId], guardando: false }
            }));
        }
    };

    const postersFiltrados = posters.filter(p =>
        `${p.titulo} ${p.autores} ${p.descripcion} ${p.categoria} ${p.palabras_clave} ${p.nombre_usuario || ''} ${p.nombre_espacio || ''}`
            .toLowerCase()
            .includes(filtro.toLowerCase())
    );

    const postersMostrar = limite ? postersFiltrados.slice(0, limite) : postersFiltrados;

    const esAdminOSuper = ['admin', 'administrador', 'superadmin'].includes(rolUsuario.toLowerCase());
    const esEvaluador = rolUsuario.toLowerCase() === 'evaluador' || soloAsignados;

    const totalColumnas = esEvaluador
        ? 7 + criterios.length
        : 7;

    return (
        <section id="mostrar-posters" className={limite ? "preview-posters" : "todos-posters"}>
            {cerrarTabla && (
                <button className="cerrar-tabla" onClick={cerrarTabla}>X</button>
            )}

            {!limite && (
                <h2>
                    {soloMisPosters
                        ? "Mis Pósters Publicados"
                        : esEvaluador
                            ? "Pósters Asignados para Evaluación"
                            : "Todos los Pósters Publicados"}
                </h2>
            )}

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Autores</th>
                            <th>Categoría</th>
                            <th>Ubicación Física</th>
                            <th>Archivo</th>
                            <th>Código QR</th>

                            {(soloMisPosters || rolUsuario.toLowerCase() === 'usuario') && <th>Nota Promedio</th>}

                            {esEvaluador && criterios.map(crit => (
                                <th key={crit.id} style={{ minWidth: '90px' }}>
                                    {crit.nombre}
                                </th>
                            ))}

                            {esEvaluador && (
                                <>
                                    <th style={{ width: '80px' }}>Promedio</th>
                                    <th>Observaciones</th>
                                    <th>Acción</th>
                                </>
                            )}

                            {!esEvaluador && <th>Descripción</th>}
                            {!esEvaluador && !soloMisPosters && <th>Usuario</th>}
                            {esAdminOSuper && <th>Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={totalColumnas} style={{ textAlign: "center", padding: "20px" }}>
                                    Cargando pósters...
                                </td>
                            </tr>
                        ) : postersMostrar.length === 0 ? (
                            <tr>
                                <td colSpan={totalColumnas} style={{ textAlign: "center", padding: "20px" }}>
                                    {esEvaluador
                                        ? "No tienes pósters asignados para evaluar"
                                        : soloMisPosters
                                            ? "No has publicado pósters aún"
                                            : "No hay pósters disponibles"}
                                </td>
                            </tr>
                        ) : (
                            postersMostrar.map(poster => {
                                const evalState = evaluacionesMap[poster.id] || {
                                    criterios: {},
                                    observaciones: '',
                                    editando: true
                                };

                                const calificacionRecibida = calificacionesUsuarioMap[poster.id];
                                const promedioNota = calcularPromedioRecibido(calificacionRecibida);

                                return (
                                    <tr key={poster.id}>
                                        <td><strong>{poster.titulo}</strong></td>
                                        <td>{poster.autores}</td>
                                        <td>
                                            <span className="badge-categoria">{poster.categoria}</span>
                                        </td>

                                        {/* Celda de Ubicación Física y Número Asignado */}
                                        <td>
                                            {poster.nombre_espacio ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ backgroundColor: '#e0f7fa', color: '#006064', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85em', fontWeight: 'bold' }}>
                                                        📍 {poster.nombre_espacio} {poster.ubicacion_detallada && (
                                                            <span>
                                                                - # <strong>{poster.ubicacion_detallada}</strong>
                                                            </span>
                                                        )}
                                                    </span>

                                                </div>
                                            ) : (
                                                <span style={{ color: '#999', fontStyle: 'italic', fontSize: '0.85em' }}>
                                                    Sin asignar
                                                </span>
                                            )}
                                        </td>

                                        <td>
                                            {poster.imagen ? (
                                                <button
                                                    className="btn-ver-archivo"
                                                    onClick={() => setImagenSeleccionada(construirUrlArchivo(poster.imagen))}
                                                    style={{ padding: '4px 8px', cursor: 'pointer' }}
                                                >
                                                    👁️ Ver
                                                </button>
                                            ) : (
                                                <span>Sin archivo</span>
                                            )}
                                        </td>

                                        <td>
                                            <button
                                                onClick={() => setPosterParaQR(poster)}
                                                title="Ver código QR del póster"
                                                style={{ background: '#6f42c1', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                📱 QR
                                            </button>
                                        </td>

                                        {(soloMisPosters || rolUsuario.toLowerCase() === 'usuario') && (
                                            <td>
                                                {promedioNota !== null ? (
                                                    <button
                                                        onClick={() => setModalDetalleEval({ poster, evaluacion: calificacionRecibida })}
                                                        style={{
                                                            backgroundColor: '#e8f5e9',
                                                            color: '#2e7d32',
                                                            border: '1px solid #a5d6a7',
                                                            padding: '6px 12px',
                                                            borderRadius: '20px',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                        title="Haz clic para ver el desglose por criterio y observaciones"
                                                    >
                                                        {promedioNota}
                                                    </button>
                                                ) : (
                                                    <span style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '0.9em' }}>
                                                        ⏳ Pendiente
                                                    </span>
                                                )}
                                            </td>
                                        )}

                                        {esEvaluador && criterios.map(crit => (
                                            <td key={crit.id}>
                                                <span style={{ fontWeight: evalState.existente ? 700 : 400, color: evalState.existente ? '#132740' : '#9aa0a6' }}>{(parseFloat(evalState.criterios[crit.id] ?? 0).toFixed(1))}</span>
                                            </td>
                                        ))}

                                        {esEvaluador && (
                                            <>
                                                <td>
                                                    <strong style={{ color: '#0056b3' }}>
                                                        {calcularPromedioDinamico(evalState.criterios)}
                                                    </strong>
                                                </td>

                                                <td>
                                                    <small style={{ color: evalState.observaciones ? '#132740' : '#9aa0a6' }}>{evalState.observaciones ? (evalState.observaciones.slice(0, 42) + (evalState.observaciones.length > 42 ? '…' : '')) : '—'}</small>
                                                </td>

                                                <td>
                                                    {evalState.existente ? (
                                                        <button onClick={() => setPosterAEvaluar(poster)} className="btn-accion-tabla btn-evaluar">✏️ Editar</button>
                                                    ) : (
                                                        <button onClick={() => setPosterAEvaluar(poster)} className="btn-accion-tabla btn-asignar">⭐ Calificar</button>
                                                    )}
                                                </td>
                                            </>
                                        )}

                                        {!esEvaluador && <td className="descripcion-celda">{poster.descripcion}</td>}
                                        {!esEvaluador && !soloMisPosters && <td>{poster.nombre_usuario || 'Sin usuario'}</td>}

                                        {esAdminOSuper && (
                                            <td>
                                                <button
                                                    className="btn-accion-tabla btn-asignar"
                                                    onClick={() => setPosterAAsignar(poster)}
                                                >
                                                    👥 Asignar Evaluador
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="filtros">
                <input
                    type="text"
                    placeholder="Buscar por título, autores, categoría, ubicación..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro"
                />
                {limite && verMas && postersFiltrados.length > limite && (
                    <a href="#" className="ver-mas" onClick={(e) => {
                        e.preventDefault();
                        verMas();
                    }}>
                        Ver más...
                    </a>
                )}
            </div>

            {imagenSeleccionada && (
                <div className="modal-imagen" onClick={() => setImagenSeleccionada(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <button className="cerrar-modal" onClick={() => setImagenSeleccionada(null)}>×</button>
                        {imagenSeleccionada.toLowerCase().endsWith('.pdf') ? (
                            <iframe
                                src={imagenSeleccionada}
                                className="pdf-grande"
                                title="Póster PDF"
                                style={{ width: '100%', height: '80vh', border: 'none' }}
                            />
                        ) : (
                            <img src={imagenSeleccionada} alt="Póster completo" className="imagen-grande" />
                        )}
                    </div>
                </div>
            )}

            {posterAAsignar && (
                <AsignarEvaluadorModal
                    poster={posterAAsignar}
                    cerrarModal={() => setPosterAAsignar(null)}
                />
            )}

            {modalDetalleEval && (
                <DetallesCalificacionModal
                    poster={modalDetalleEval.poster}
                    evaluacion={modalDetalleEval.evaluacion}
                    cerrarModal={() => setModalDetalleEval(null)}
                />
            )}

            {posterAEvaluar && (
                <ModalEvaluacion poster={posterAEvaluar} criterios={criterios} evaluacionInicial={evaluacionesMap[posterAEvaluar.id]} idEvaluador={idUsuarioActual} onClose={() => setPosterAEvaluar(null)} onGuardado={() => cargarCriteriosYPosters()} />
            )}

            {posterParaQR && (
                <div className="modal" onClick={() => setPosterParaQR(null)}>
                    <section className="formularios" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <button className="cerrar-formulario" onClick={() => setPosterParaQR(null)}>X</button>
                        <h2>📱 Código QR del Póster</h2>
                        <p>Escanea para ver la versión digital</p>
                        <TarjetaPosterQR
                            poster={posterParaQR}
                            urlDigital={construirUrlArchivo(posterParaQR.imagen) || `${window.location.origin}/poster/${posterParaQR.id}`}
                        />
                    </section>
                </div>
            )}
        </section>
    );
};

export default MostrarPosters;