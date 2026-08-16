import React, { useState, useEffect } from 'react';
import "./roles.css";
import AsignarEvaluadorModal from '../generales/AsignarEvaluadorModal.jsx';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const construirUrlArchivo = (rutaImagen) => {
    if (!rutaImagen) return null;
    const nombreArchivo = rutaImagen.split('/').pop();
    return `${SERVER_URL}/imgPosters/${encodeURIComponent(nombreArchivo)}`;
};

const MostrarPosters = ({ cerrarTabla, limite = null, verMas, soloMisPosters = false, soloAsignados = false, idEvaluador = null }) => {
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
    const [filtro, setFiltro] = useState("");

    // Estado de evaluaciones por cada póster ID { [id_poster]: { contenido, diseno, exposicion, observaciones, editando, guardando, mensaje } }
    const [evaluacionesMap, setEvaluacionesMap] = useState({});

    // Modal asignación admin
    const [posterAAsignar, setPosterAAsignar] = useState(null);

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
        if (idUsuarioActual || !soloAsignados) {
            cargarTodosPosters();
        }
    }, [soloMisPosters, soloAsignados, idUsuarioActual]);

    const cargarTodosPosters = async () => {
        try {
            setLoading(true);
            let url = `${SERVER_URL}/api/TablaPosters.php`;
            const params = [];

            if (soloMisPosters) {
                const idUsuario = localStorage.getItem("idUsuario") || localStorage.getItem("id_usuario");
                if (idUsuario) params.push(`id_usuario=${idUsuario}`);
            }

            const idEv = idEvaluador || idUsuarioActual;
            if (soloAsignados || rolUsuario.toLowerCase() === 'evaluador') {
                if (idEv) params.push(`id_evaluador=${idEv}`);
            }

            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            const respuesta = await fetch(url);
            const datos = await respuesta.json();

            if (datos.success) {
                setPosters(datos.data);
                // Si es evaluador, cargar evaluaciones previas para cada póster
                if (rolUsuario.toLowerCase() === 'evaluador' || soloAsignados) {
                    cargarEvaluacionesParaPosters(datos.data, idEv);
                }
            }
        } catch (error) {
            console.error('Error al cargar los posters:', error);
        } finally {
            setLoading(false);
        }
    };

    const cargarEvaluacionesParaPosters = async (listaPosters, idEv) => {
        if (!idEv) return;
        const mapa = {};

        for (const p of listaPosters) {
            try {
                const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php?id_poster=${p.id}&id_evaluador=${idEv}`);
                const data = await res.json();

                if (data.success && data.data && data.data.length > 0) {
                    const ev = data.data[0];
                    mapa[p.id] = {
                        contenido: parseFloat(ev.calificacion_contenido) || 0,
                        diseno: parseFloat(ev.calificacion_diseno) || 0,
                        exposicion: parseFloat(ev.calificacion_exposicion) || 0,
                        promedio: parseFloat(ev.promedio_total) || 0,
                        observaciones: ev.observaciones || '',
                        existente: true,
                        editando: false
                    };
                } else {
                    mapa[p.id] = {
                        contenido: 0,
                        diseno: 0,
                        exposicion: 0,
                        promedio: 0,
                        observaciones: '',
                        existente: false,
                        editando: true // Si no existe, permite ingresar nota directamente
                    };
                }
            } catch (err) {
                console.error(`Error al cargar evaluación del póster ${p.id}`, err);
            }
        }
        setEvaluacionesMap(mapa);
    };

    const handleCampoEvaluacionChange = (posterId, campo, valor) => {
        setEvaluacionesMap(prev => {
            const actual = prev[posterId] || { contenido: 0, diseno: 0, exposicion: 0, observaciones: '', editando: true };
            const nuevoState = { ...actual, [campo]: valor };

            // Recalcular promedio al vuelo
            if (['contenido', 'diseno', 'exposicion'].includes(campo)) {
                const c = campo === 'contenido' ? parseFloat(valor) || 0 : parseFloat(nuevoState.contenido) || 0;
                const d = campo === 'diseno' ? parseFloat(valor) || 0 : parseFloat(nuevoState.diseno) || 0;
                const e = campo === 'exposicion' ? parseFloat(valor) || 0 : parseFloat(nuevoState.exposicion) || 0;
                nuevoState.promedio = ((c + d + e) / 3).toFixed(2);
            }
            return { ...prev, [posterId]: nuevoState };
        });
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
            calificacion_contenido: parseFloat(ev.contenido) || 0,
            calificacion_diseno: parseFloat(ev.diseno) || 0,
            calificacion_exposicion: parseFloat(ev.exposicion) || 0,
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
                        promedio: data.promedio_total || prev[posterId].promedio,
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
        `${p.titulo} ${p.autores} ${p.descripcion} ${p.categoria} ${p.palabras_clave} ${p.nombre_usuario}`
            .toLowerCase()
            .includes(filtro.toLowerCase())
    );

    const postersMostrar = limite ? postersFiltrados.slice(0, limite) : postersFiltrados;

    const esAdminOSuper = ['admin', 'administrador', 'superadmin'].includes(rolUsuario.toLowerCase());
    const esEvaluador = rolUsuario.toLowerCase() === 'evaluador' || soloAsignados;

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
                            <th>Archivo</th>

                            {/* Columnas exclusivas de Evaluación */}
                            {esEvaluador && (
                                <>
                                    <th style={{ width: '80px' }}>Contenido</th>
                                    <th style={{ width: '80px' }}>Diseño</th>
                                    <th style={{ width: '80px' }}>Exposición</th>
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
                                <td colSpan={esEvaluador ? "10" : "8"} style={{ textAlign: "center", padding: "20px" }}>
                                    Cargando pósters...
                                </td>
                            </tr>
                        ) : postersMostrar.length === 0 ? (
                            <tr>
                                <td colSpan={esEvaluador ? "10" : "8"} style={{ textAlign: "center", padding: "20px" }}>
                                    {esEvaluador
                                        ? "No tienes pósters asignados para evaluar"
                                        : "No hay pósters disponibles"}
                                </td>
                            </tr>
                        ) : (
                            postersMostrar.map(poster => {
                                const evalState = evaluacionesMap[poster.id] || {
                                    contenido: 0,
                                    diseno: 0,
                                    exposicion: 0,
                                    promedio: 0,
                                    observaciones: '',
                                    editando: true
                                };

                                return (
                                    <tr key={poster.id}>
                                        <td><strong>{poster.titulo}</strong></td>
                                        <td>{poster.autores}</td>
                                        <td>
                                            <span className="badge-categoria">{poster.categoria}</span>
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

                                        {/* Columnas de evaluación e inputs en línea */}
                                        {esEvaluador && (
                                            <>
                                                <td>
                                                    {evalState.editando ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="5"
                                                            step="0.1"
                                                            value={evalState.contenido}
                                                            onChange={(e) => handleCampoEvaluacionChange(poster.id, 'contenido', e.target.value)}
                                                            style={{ width: '60px' }}
                                                        />
                                                    ) : (
                                                        <span>{evalState.contenido}</span>
                                                    )}
                                                </td>

                                                <td>
                                                    {evalState.editando ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="5"
                                                            step="0.1"
                                                            value={evalState.diseno}
                                                            onChange={(e) => handleCampoEvaluacionChange(poster.id, 'diseno', e.target.value)}
                                                            style={{ width: '60px' }}
                                                        />
                                                    ) : (
                                                        <span>{evalState.diseno}</span>
                                                    )}
                                                </td>

                                                <td>
                                                    {evalState.editando ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="5"
                                                            step="0.1"
                                                            value={evalState.exposicion}
                                                            onChange={(e) => handleCampoEvaluacionChange(poster.id, 'exposicion', e.target.value)}
                                                            style={{ width: '60px' }}
                                                        />
                                                    ) : (
                                                        <span>{evalState.exposicion}</span>
                                                    )}
                                                </td>

                                                <td>
                                                    <strong style={{ color: '#0056b3' }}>
                                                        {evalState.promedio || '0.00'}
                                                    </strong>
                                                </td>

                                                <td>
                                                    {evalState.editando ? (
                                                        <textarea
                                                            rows="2"
                                                            value={evalState.observaciones}
                                                            onChange={(e) => handleCampoEvaluacionChange(poster.id, 'observaciones', e.target.value)}
                                                            placeholder="Observaciones..."
                                                            style={{ width: '100%', fontSize: '0.85em' }}
                                                        />
                                                    ) : (
                                                        <small>{evalState.observaciones || 'Sin observaciones'}</small>
                                                    )}
                                                </td>

                                                <td>
                                                    {evalState.editando ? (
                                                        <button
                                                            onClick={() => guardarEvaluacionFila(poster.id)}
                                                            disabled={evalState.guardando}
                                                            style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                                        >
                                                            {evalState.guardando ? '...' : 'Guardar'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => alternarEditar(poster.id)}
                                                            style={{ backgroundColor: '#ffc107', color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                                        >
                                                            ✏️ Editar
                                                        </button>
                                                    )}
                                                    {evalState.mensaje && (
                                                        <span style={{ display: 'block', color: 'green', fontSize: '0.75em' }}>
                                                            {evalState.mensaje}
                                                        </span>
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
                    placeholder="Buscar por título, autores, categoría..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro"
                />
            </div>

            {limite && verMas && postersFiltrados.length > limite && (
                <div className="contenedor-vermas">
                    <a href="#" className="ver-mas" onClick={(e) => {
                        e.preventDefault();
                        verMas();
                    }}>
                        Ver más...
                    </a>
                </div>
            )}

            {/* Modal de Imagen / PDF */}
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

            {/* Modal de Asignar Evaluador */}
            {posterAAsignar && (
                <AsignarEvaluadorModal
                    poster={posterAAsignar}
                    cerrarModal={() => setPosterAAsignar(null)}
                />
            )}
        </section>
    );
};

export default MostrarPosters; 