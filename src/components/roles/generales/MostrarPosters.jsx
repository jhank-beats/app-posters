import React, { useState, useEffect, useMemo } from 'react';
import "./roles.css";
import AsignarEvaluadorModal from '../generales/AsignarEvaluadorModal.jsx';
import DetallesCalificacionModal from './DetallesCalificacionModal.jsx';
import ModalEvaluacion from './ModalEvaluacion.jsx';
import TarjetaPosterQR from './TarjetaPosterQR.jsx';
import VistaPreviaPoster from './VistaPreviaPoster.jsx';
import { imprimirCertificados } from './CertificadoPremio.jsx';
import { obtenerRondasResumen } from '../../../api/rondasResumen.js';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const construirUrlArchivo = (rutaImagen) => {
    if (!rutaImagen) return null;
    const nombreArchivo = rutaImagen.split('/').pop();
    return `${SERVER_URL}/imgPosters/${encodeURIComponent(nombreArchivo)}`;
};

// Estado del póster en el evento, para la vista del autor (§6.3).
// Se exporta para pruebas y reutilización.
export const estadoDelAutor = (poster) => {
    const rondas = (poster.rondas || []).slice().sort((a, b) => a.numero - b.numero);
    if (rondas.length === 0) return { texto: 'En espera', clase: 'rol-1', ganadora: null };

    const ganadoras = rondas.filter(r => r.lugar);
    const conPremio = ganadoras[0] || null;
    if (conPremio) {
        return {
            texto: `Ganador ${conPremio.premio || `${conPremio.lugar}º lugar`}`,
            clase: 'badge-premio',
            ganadora: conPremio,
            ganadoras,
        };
    }

    const ultimaSeleccion = [...rondas].reverse().find(r => r.seleccionado);
    if (ultimaSeleccion) {
        if (ultimaSeleccion.estado === 'cerrada') return { texto: 'Finalista', clase: 'rol-4', ganadora: null, ganadoras: [] };
        return { texto: `Pasó a la ronda ${ultimaSeleccion.numero}`, clase: 'rol-2', ganadora: null, ganadoras: [] };
    }

    const enEvaluacion = rondas.find(r =>
        r.estado === 'abierta' && (Number(r.evaluadores_ronda || 0) > 0 || Number(r.n_evaluaciones || 0) > 0)
    );
    if (enEvaluacion) {
        return { texto: 'En evaluación', clase: 'rol-3', ganadora: null, ganadoras: [] };
    }
    return { texto: 'En espera', clase: 'rol-1', ganadora: null, ganadoras: [] };
};

// Diploma del ganador (vista del autor): abre la misma hoja imprimible que
// usa el admin, con los datos del póster y su premio. Desde esa ventana el
// ganador imprime o guarda el PDF.
const descargarDiploma = (poster, rondaEspecifica = null) => {
    const g = rondaEspecifica || estadoDelAutor(poster).ganadora;
    if (!g) return;
    imprimirCertificados({
        titulo: poster.titulo,
        autores: poster.autores,
        nombre_autor: poster.nombre_usuario || poster.autores,
        lugar: g.lugar,
        premio: g.premio,
    }, {
        nombre_evento: g.nombre_evento || poster.nombre_evento,
        codigo_evento: g.codigo_evento || poster.codigo_evento,
    }, {
        titulo: `Diploma - ${g.premio || `${g.lugar}º lugar`}`,
    });
};

const MostrarPosters = ({ cerrarTabla, limite = null, verMas, soloMisPosters = false, soloAsignados = false, idEvaluador = null, recargarClave = 0, idRondaInicial = '', onRondaChange = null }) => {
    const [posters, setPosters] = useState([]);
    const [criterios, setCriterios] = useState([]);
    const [rondas, setRondas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [posterEnVista, setPosterEnVista] = useState(null);
    const [filtro, setFiltro] = useState("");

    // Filtros de ronda (§6.2)
    const [idRonda, setIdRonda] = useState("");
    const [orden, setOrden] = useState("promedio_desc");
    const [soloSeleccionados, setSoloSeleccionados] = useState(false);
    const [soloPendientes, setSoloPendientes] = useState(false);

    // Filtros por nota: nota mínima (1.0 - 5.0) y ocultar los sin calificar.
    // El texto del input se separa del valor aplicado para no pedir la lista
    // completa en cada tecla.
    const [notaMinimaTexto, setNotaMinimaTexto] = useState("");
    const [notaMinima, setNotaMinima] = useState("");
    const [soloEvaluados, setSoloEvaluados] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setNotaMinima(notaMinimaTexto.trim()), 500);
        return () => clearTimeout(t);
    }, [notaMinimaTexto]);

    // Las rondas se cargan antes que los pósters: sin saber cuál es la
    // vigente, la vista "Todas" mezclaría criterios de todas las rondas.
    const [rondasListas, setRondasListas] = useState(false);

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
        cargarRondas();
    }, []);

    // La vista del evaluador puede fijar la ronda desde sus pestañas.
    useEffect(() => {
        if (idRondaInicial === undefined || idRondaInicial === null) return;
        setIdRonda(String(idRondaInicial || ''));
    }, [idRondaInicial]);

    const cambiarRonda = (valor) => {
        setIdRonda(valor);
        if (onRondaChange) onRondaChange(valor);
    };

    // Ronda de la que se muestran criterios y notas: la seleccionada, o en su
    // defecto la vigente (última ronda abierta de los eventos listados; si no
    // hay ninguna abierta, la última). Sin esto, la vista "Todas" traía los
    // criterios de TODAS las rondas (duplicados) y promediaba notas de rondas
    // distintas. Devuelve SIEMPRE un objeto de `rondas` (referencia estable)
    // para no volver a disparar el effect de carga en bucle.
    const rondaVista = useMemo(() => {
        if (idRonda) return rondas.find(r => String(r.id_ronda) === String(idRonda)) || null;
        if (rondas.length === 0) return null;
        let candidatas = rondas;
        const idsEventos = new Set(posters.map(p => p.id_evento).filter(Boolean));
        if (idsEventos.size > 0) {
            const delEvento = rondas.filter(r => idsEventos.has(r.id_evento));
            if (delEvento.length > 0) candidatas = delEvento;
        }
        const abiertas = candidatas.filter(r => r.estado === 'abierta');
        const conjunto = abiertas.length > 0 ? abiertas : candidatas;
        return conjunto.reduce((a, b) => (Number(b.numero) > Number(a.numero) ? b : a));
    }, [idRonda, rondas, posters]);

    const rondaTrabajoId = idRonda || (rondaVista ? String(rondaVista.id_ronda) : '');

    useEffect(() => {
        cargarCriteriosYPosters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [soloMisPosters, soloAsignados, idEvaluador, recargarClave, idRonda, orden, soloSeleccionados, rondasListas, rondaTrabajoId, notaMinima, soloEvaluados]);

    const cargarRondas = async () => {
        try {
            const data = await obtenerRondasResumen();
            if (data.success) {
                const lista = [];
                (data.data || []).forEach(ev => {
                    (ev.rondas || []).forEach(r => {
                        lista.push({
                            id_ronda: r.id_ronda,
                            numero: r.numero,
                            nombre: r.nombre,
                            estado: r.estado,
                            id_evento: ev.id_evento,
                            nombre_evento: ev.nombre_evento,
                            codigo_evento: ev.codigo_evento
                        });
                    });
                });
                setRondas(lista);
            }
        } catch (err) {
            console.error('Error al cargar rondas:', err);
        } finally {
            setRondasListas(true);
        }
    };

    const cargarCriteriosYPosters = async () => {
        try {
            setLoading(true);

            const rol = localStorage.getItem("rol") || localStorage.getItem("rolUsuario") || "";
            const idUsr = idEvaluador || localStorage.getItem("idUsuario") || localStorage.getItem("id_usuario");

            // 1. Criterios y pósters en paralelo: se esperan a la vez, no en cascada.
            // Los criterios SIEMPRE son los de la ronda de trabajo: sin filtro,
            // Criterios.php devuelve los de todas las rondas (duplicados).
            const urlCrit = rondaTrabajoId
                ? `${SERVER_URL}/api/Criterios.php?id_ronda=${rondaTrabajoId}`
                : `${SERVER_URL}/api/Criterios.php`;

            const params = [];

            // El orden se manda SIEMPRE. Antes solo se enviaba con ronda
            // seleccionada, así que en "Todas las rondas" el selector de
            // promedio no hacía nada. Sin ronda, el servidor ordena por el
            // promedio general del póster.
            params.push(`orden=${orden}`);
            if (notaMinima !== '') params.push(`nota_minima=${encodeURIComponent(notaMinima)}`);
            if (soloEvaluados) params.push('solo_evaluados=1');

            const rondaFiltro = soloMisPosters ? idRonda : rondaTrabajoId;
            if (rondaFiltro) {
                // Unificar listado y guardado en la misma ronda (fix bug Fase 1):
                // en vista evaluador/admin siempre se envía la ronda de trabajo;
                // en "Mis pósters publicados" solo cuando el autor filtra por ronda.
                params.push(`id_ronda=${rondaFiltro}`);
                if (soloSeleccionados) params.push('solo_seleccionados=1');
            }
            if (soloMisPosters) params.push('todas_las_rondas=1');

            if (soloMisPosters && idUsr) {
                params.push(`id_usuario=${idUsr}`);
            }

            if (!soloMisPosters && (soloAsignados || rol.toLowerCase() === 'evaluador') && idUsr) {
                params.push(`id_evaluador=${idUsr}`);
            }

            const url = `${SERVER_URL}/api/TablaPosters.php${params.length > 0 ? `?${params.join('&')}` : ''}`;

            const [dataCrit, datos] = await Promise.all([
                fetch(urlCrit).then(r => r.json()).catch(() => null),
                fetch(url).then(r => r.json()).catch(() => null),
            ]);

            let listaCriterios = [];
            if (dataCrit && dataCrit.success) {
                listaCriterios = dataCrit.data || [];
                setCriterios(listaCriterios);
            }

            if (datos && datos.success) {
                const listaPosters = datos.data || [];
                setPosters(listaPosters);

                const ids = listaPosters.map(p => p.id);
                if (!soloMisPosters && (rol.toLowerCase() === 'evaluador' || soloAsignados)) {
                    await cargarEvaluacionesParaPosters(ids, listaCriterios, idUsr);
                } else {
                    await cargarCalificacionesRecibidas(ids);
                }
            }
        } catch (error) {
            console.error('Error general al cargar los pósters:', error);
        } finally {
            setLoading(false);
        }
    };

    // Las notas de TODOS los pósters en UNA sola petición (antes: 1 por póster).
    const cargarCalificacionesRecibidas = async (ids) => {
        if (!ids || ids.length === 0) {
            setCalificacionesUsuarioMap({});
            return;
        }
        try {
            // Misma ronda de trabajo que el listado: si no, la nota mostrada
            // promedia todas las rondas mientras la tabla es de una sola.
            const urlRonda = rondaTrabajoId ? `&id_ronda=${rondaTrabajoId}` : '';
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php?ids=${ids.join(',')}${urlRonda}`);
            const data = await res.json();
            const resultados = data.resultados || {};
            const mapaCalificaciones = {};
            Object.keys(resultados).forEach(k => {
                const r = resultados[k];
                if (r && r.success && r.evaluaciones && Object.keys(r.evaluaciones).length > 0) {
                    mapaCalificaciones[k] = r;
                }
            });
            setCalificacionesUsuarioMap(mapaCalificaciones);
        } catch (err) {
            console.error('Error al consultar las calificaciones recibidas', err);
        }
    };

    // Igual que arriba, pero las notas de ESTE evaluador en todos los pósters:
    // una sola petición en lugar de N.
    const cargarEvaluacionesParaPosters = async (ids, listaCriterios, idEv) => {
        if (!idEv || !ids || ids.length === 0) {
            setEvaluacionesMap({});
            return;
        }
        try {
            // Notas de la ronda de trabajo: sin esto se mezclaban las notas de
            // rondas distintas y el promedio salía con las de todas.
            const urlRonda = rondaTrabajoId ? `&id_ronda=${rondaTrabajoId}` : '';
            const res = await fetch(`${SERVER_URL}/api/Evaluaciones.php?ids=${ids.join(',')}&id_evaluador=${idEv}${urlRonda}`);
            const data = await res.json();
            const resultados = data.resultados || {};

            const mapa = {};
            ids.forEach(idp => {
                const r = resultados[idp] || null;
                const ev = r ? r.evaluaciones : null;
                const tieneNotas = !!ev && (Array.isArray(ev) ? ev.length : Object.keys(ev).length) > 0;

                const notasCriterios = {};
                listaCriterios.forEach(c => {
                    const val = ev ? parseFloat(ev[c.id]) : NaN;
                    notasCriterios[c.id] = !isNaN(val) ? val : 0;
                });

                mapa[idp] = {
                    criterios: notasCriterios,
                    observaciones: (r && r.observaciones) || '',
                    existente: tieneNotas,
                    editando: false
                };
            });
            setEvaluacionesMap(mapa);
        } catch (err) {
            console.error('Error al cargar las evaluaciones del evaluador', err);
        }
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

    const calcularPromedioDinamico = (criteriosObj) => {
        if (!criteriosObj) return '0.00';
        const listaValores = Object.values(criteriosObj);
        if (listaValores.length === 0) return '0.00';
        const suma = listaValores.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        return (suma / listaValores.length).toFixed(2);
    };

    // Recalcula solo cuando cambian los datos o los filtros: teclear en el
    // buscador ya no re-filtra construyendo el texto de cada fila.
    const postersFiltrados = useMemo(() => {
        const texto = filtro.toLowerCase();
        return posters.filter(p => {
            const coincideTexto = `${p.titulo} ${p.autores} ${p.profesores_resumen || ''} ${p.descripcion} ${p.categoria} ${p.palabras_clave} ${p.nombre_usuario || ''} ${p.nombre_espacio || ''} ${p.nombre_evento || ''} ${p.codigo_evento || ''}`
                .toLowerCase()
                .includes(texto);

            // "Solo pendientes de calificar": sin nota en la ronda de trabajo.
            // Usa calificable/motivo del servidor: los no asignados no cuentan
            // como pendientes (muestran 🚫 con el motivo antes de calificar).
            const pendiente = (p.calificable !== false)
                && (rondaTrabajoId
                    ? (parseInt(p.n_evaluaciones_ronda || 0, 0) === 0 || parseInt(p.pendientes_ronda || 0, 10) > 0)
                    : !(evaluacionesMap[p.id] && evaluacionesMap[p.id].existente));

            return coincideTexto && (!soloPendientes || pendiente);
        });
        // rondaTrabajoId (no idRonda): el memo decide si el póster está
        // pendiente según la MISMA ronda que se listará y se calificará.
    }, [posters, filtro, rondaTrabajoId, soloPendientes, evaluacionesMap]);

    const postersMostrar = limite ? postersFiltrados.slice(0, limite) : postersFiltrados;

    // La sesión solo guarda id_rol numérico (1=usuario, 2=evaluador,
    // 3=admin, 4=superadmin); el nombre en texto es un respaldo.
    // Cuando `soloMisPosters` es true (p. ej. "Mis pósters publicados" en el
    // panel del evaluador), se muestra la vista de autor desacoplada de las
    // columnas de calificación.
    const idRol = parseInt(localStorage.getItem("id_rol") || "0", 10);
    const nombreRol = (rolUsuario || "").toLowerCase();
    const esAdminOSuper = !soloMisPosters && (idRol === 3 || idRol === 4 || ['admin', 'administrador', 'superadmin', 'super admin'].includes(nombreRol));
    const esEvaluador = !soloMisPosters && (idRol === 2 || nombreRol === 'evaluador' || soloAsignados);
    const hayRonda = !!idRonda;
    // Ronda mostrada/seleccionada: la explícita o, en "Todas", la vigente.
    const rondaSel = rondaVista;
    const rondaCerrada = rondaSel ? rondaSel.estado !== 'abierta' : false;

    const mostrarPromedioRonda = hayRonda;
    const mostrarEstadoRonda = hayRonda;
    // Vista del autor (estado por ronda) desacoplada de la vista del evaluador:
    // el evaluador no ve la columna "Selección" (premios/corte del admin).
    const mostrarSeleccion = (hayRonda || soloMisPosters) && !esEvaluador;
    const mostrarRondasUsuario = soloMisPosters;
    const esVistaUsuario = soloMisPosters || (!esEvaluador && !esAdminOSuper && (idRol === 1 || nombreRol === 'usuario'));

    const contarColumnas = () => {
        let total = 8; // Título, Autores, Profesores/Materias, Evento, Categoría, Ubicación, Archivo, QR
        if (mostrarRondasUsuario) total += 1;
        if (mostrarPromedioRonda) total += 1;
        if (mostrarEstadoRonda) total += 1;
        if (mostrarSeleccion && !mostrarRondasUsuario) total += 1;
        if (esVistaUsuario) total += 1; // Nota Promedio
        if (esEvaluador) {
            total += criterios.length + 3; // criterios + Promedio + Observaciones + Acción
        } else {
            total += 1; // Descripción
            if (!soloMisPosters) total += 1; // Usuario
        }
        if (esAdminOSuper || esEvaluador) total += 1; // Nota promedio
        if (esAdminOSuper) total += 1; // Acciones
        return total;
    };

    const totalColumnas = contarColumnas();

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
                            <th>Profesores / Materias</th>
                            <th>Evento</th>
                            <th>Categoría</th>
                            <th>Ubicación Física</th>
                            <th>Archivo</th>
                            <th>Código QR</th>

                            {mostrarRondasUsuario && <th>Estado por ronda</th>}
                            {mostrarPromedioRonda && <th>Promedio</th>}
                            {mostrarEstadoRonda && <th>Estado</th>}
                            {mostrarSeleccion && !mostrarRondasUsuario && <th>Selección</th>}
                            {(esAdminOSuper || esEvaluador) && <th>Nota promedio</th>}

                            {esVistaUsuario && <th>Nota Promedio</th>}

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
                                const estadoAutor = soloMisPosters ? estadoDelAutor(poster) : null;
                                const calificable = poster.calificable !== false;
                                const motivoBloqueo = poster.motivo_bloqueo || '';

                                return (
                                    <tr key={poster.id}>
                                        <td><strong>{poster.titulo}</strong></td>
                                        <td>{poster.autores}</td>

                                        <td>
                                            {Array.isArray(poster.profesores) && poster.profesores.length > 0 ? (
                                                <div className="celda-profesores">
                                                    {poster.profesores.map((pr, idx) => (
                                                        <span className="badge-profesor-materia" key={pr.id || idx}>
                                                            👨‍🏫 {pr.nombre_profesor}
                                                            {pr.materia && <small> · {pr.materia}</small>}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : poster.profesores_resumen ? (
                                                <span>{poster.profesores_resumen}</span>
                                            ) : (
                                                <span className="subtexto-celda">—</span>
                                            )}
                                        </td>

                                        {/* Evento al que pertenece el póster (visible para todos los roles) */}
                                        <td>
                                            {poster.nombre_evento ? (
                                                <span className="badge-evento">
                                                    <span className="badge-evento-icono" aria-hidden="true">🎓</span>
                                                    <span className="badge-evento-texto">
                                                        {poster.nombre_evento}
                                                        {poster.codigo_evento && (
                                                            <small>{poster.codigo_evento}</small>
                                                        )}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="sin-evento">Sin evento</span>
                                            )}
                                        </td>

                                        <td>
                                            <span className="badge-categoria">{poster.categoria}</span>
                                        </td>

                                        {/* Celda de Ubicación Física y Número Asignado */}
                                        <td>
                                            {poster.nombre_espacio ? (
                                                <span className="badge-ubicacion-espacio">
                                                    <span aria-hidden="true">📍</span>
                                                    <span>{poster.nombre_espacio}</span>
                                                    {poster.ubicacion_detallada && (
                                                        <strong className="badge-ubicacion-num">
                                                            #{poster.ubicacion_detallada}
                                                        </strong>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="subtexto-celda" style={{ fontStyle: 'italic' }}>
                                                    Sin asignar
                                                </span>
                                            )}
                                        </td>

                                        <td>
                                            {poster.imagen ? (
                                                poster.imagen.toLowerCase().endsWith('.pdf') ? (
                                                    <div
                                                        className="pdf-miniatura"
                                                        onClick={() => setPosterEnVista(poster)}
                                                        title="Ver póster"
                                                        style={{
                                                            cursor: 'pointer',
                                                            width: '48px',
                                                            height: '48px',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '1px',
                                                            border: '1px solid rgba(19, 39, 64, 0.12)',
                                                            boxShadow: '0 4px 12px rgba(19, 39, 64, 0.1)',
                                                            background: '#f5f7f8',
                                                            color: '#132740'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>📄</span>
                                                        <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em' }}>PDF</span>
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={construirUrlArchivo(poster.imagen)}
                                                        alt={poster.titulo}
                                                        className="img-miniatura"
                                                        title="Ver póster"
                                                        loading="lazy"
                                                        onClick={() => setPosterEnVista(poster)}
                                                        style={{ cursor: 'pointer', width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }}
                                                    />
                                                )
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

                                        {/* Estado del póster en el evento (vista del autor) */}
                                        {mostrarRondasUsuario && (
                                            <td>
                                                <span className={`badge-rol ${estadoAutor.clase}`}>{estadoAutor.texto}</span>
                                                {(estadoAutor.ganadoras || (estadoAutor.ganadora ? [estadoAutor.ganadora] : [])).map((g, idxG) => (
                                                    <div key={g.id_ronda || idxG} style={{ marginTop: '0.5rem' }}>
                                                        <button
                                                            type="button"
                                                            className="boton-secundario"
                                                            style={{ minHeight: '40px', whiteSpace: 'nowrap' }}
                                                            onClick={() => descargarDiploma(poster, g)}
                                                            title="Abrir tu diploma para imprimir o guardar como PDF"
                                                        >
                                                            📜 Descargar diploma{g.codigo_evento && (estadoAutor.ganadoras?.length > 1) ? ` (${g.codigo_evento})` : ''}
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="subtexto-celda">
                                                    {(poster.rondas || []).map(r => (
                                                        <div key={r.id_ronda}>
                                                            {r.codigo_evento ? `[${r.codigo_evento}] ` : ''}R{r.numero}: <strong>{r.promedio ?? '—'}</strong>
                                                            {r.n_evaluaciones > 1
                                                                ? ` (prom. de ${r.n_evaluaciones} evaluadores)`
                                                                : (r.n_evaluaciones > 0 ? ' (1 evaluación)' : '')}
                                                        </div>
                                                    ))}
                                                    {(poster.rondas || []).length === 0 && <span>Sin rondas</span>}
                                                </div>
                                            </td>
                                        )}

                                        {/* Promedio del póster en la ronda activa: con varios
                                            evaluadores (Ronda 2+) es la MEDIA de todos. */}
                                        {mostrarPromedioRonda && (
                                            <td>
                                                <span className="promedio-ronda">{poster.promedio_ronda ?? '—'}</span>
                                                <div className="subtexto-celda">
                                                    {(poster.n_evaluaciones_ronda || 0) > 1
                                                        ? `promedio de ${poster.n_evaluaciones_ronda} evaluadores`
                                                        : `${poster.n_evaluaciones_ronda || 0}${poster.evaluadores_ronda > 0 ? ` de ${poster.evaluadores_ronda}` : ''} evaluaciones`}
                                                </div>
                                            </td>
                                        )}

                                        {mostrarEstadoRonda && (
                                            <td>
                                                <span className={`badge-rol ${poster.n_evaluaciones_ronda === 0 ? 'rol-1' : (poster.pendientes_ronda > 0 ? 'rol-4' : 'rol-2')}`}>
                                                    {poster.estado_evaluacion || 'Sin evaluar'}
                                                </span>
                                            </td>
                                        )}

                                        {mostrarSeleccion && !mostrarRondasUsuario && (
                                            <td>
                                                {poster.lugar ? (
                                                    <span className="badge-premio">
                                                        🏆 {poster.premio || `${poster.lugar}º lugar`}
                                                    </span>
                                                ) : poster.seleccionado ? (
                                                    <span className="badge-rol rol-2">Seleccionado</span>
                                                ) : (
                                                    <span className="subtexto-celda">—</span>
                                                )}
                                            </td>
                                        )}

                                        {/* Nota promedio sobre todas las rondas (admin / evaluador).
                                            Es la columna que usa el filtro de nota cuando no hay
                                            ninguna ronda seleccionada. */}
                                        {(esAdminOSuper || esEvaluador) && (
                                            <td>
                                                {poster.promedio_general !== null && poster.promedio_general !== undefined ? (
                                                    <>
                                                        <span className="promedio-ronda">{poster.promedio_general}</span>
                                                        <div className="subtexto-celda">
                                                            {poster.n_evaluaciones_general || 0} evaluaciones
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="subtexto-celda">Sin nota</span>
                                                )}
                                            </td>
                                        )}

                                        {esVistaUsuario && (
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
                                                {evalState.existente ? (
                                                    <span style={{ fontWeight: 700, color: '#132740' }}>{(parseFloat(evalState.criterios[crit.id] ?? 0).toFixed(1))}</span>
                                                ) : (
                                                    <span style={{ color: '#9aa0a6' }}>—</span>
                                                )}
                                            </td>
                                        ))}

                                        {esEvaluador && (
                                            <>
                                                <td>
                                                    {evalState.existente ? (
                                                        <strong style={{ color: '#0056b3' }}>
                                                            {calcularPromedioDinamico(evalState.criterios)}
                                                        </strong>
                                                    ) : (
                                                        <span style={{ color: '#9aa0a6' }}>—</span>
                                                    )}
                                                </td>

                                                <td>
                                                    <small style={{ color: evalState.observaciones ? '#132740' : '#9aa0a6' }}>{evalState.observaciones ? (evalState.observaciones.slice(0, 42) + (evalState.observaciones.length > 42 ? '…' : '')) : '—'}</small>
                                                </td>

                                                <td>
                                                    {!calificable ? (
                                                        <span className="motivo-bloqueo" title={motivoBloqueo}>
                                                            🚫 {motivoBloqueo || 'No calificable'}
                                                        </span>
                                                    ) : rondaCerrada ? (
                                                        evalState.existente ? (
                                                            <button onClick={() => setPosterAEvaluar(poster)} className="btn-accion-tabla btn-evaluar">👁️ Ver</button>
                                                        ) : (
                                                            <span className="subtexto-celda">Ronda cerrada</span>
                                                        )
                                                    ) : evalState.existente ? (
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
                    placeholder="Buscar por título, autores, evento, categoría, ubicación..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro"
                />

                <select
                    className="input-filtro"
                    value={idRonda}
                    onChange={(e) => cambiarRonda(e.target.value)}
                    aria-label="Filtrar por ronda"
                >
                    <option value="">Todas las rondas</option>
                    {rondas.map(r => (
                        <option key={r.id_ronda} value={r.id_ronda}>
                            Ronda {r.numero} · {r.nombre} {r.estado === 'cerrada' ? '(cerrada)' : ''}
                        </option>
                    ))}
                </select>

                <select
                    className="input-filtro"
                    value={orden}
                    onChange={(e) => setOrden(e.target.value)}
                    aria-label="Ordenar por promedio o nota"
                >
                    <option value="promedio_desc">Promedio: mayor a menor</option>
                    <option value="promedio_asc">Promedio: menor a mayor</option>
                    <option value="nota_desc">Nota general: mayor a menor</option>
                    <option value="nota_asc">Nota general: menor a mayor</option>
                    <option value="fecha">Más recientes</option>
                    <option value="titulo_asc">Título (A - Z)</option>
                </select>

                <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="Nota mín. (1 - 5)"
                    value={notaMinimaTexto}
                    onChange={(e) => setNotaMinimaTexto(e.target.value)}
                    className="input-filtro"
                    style={{ maxWidth: '150px' }}
                    aria-label="Mostrar solo pósters con nota igual o superior a este valor"
                    title="Muestra solo los pósters cuya nota promedio sea igual o superior a este valor (de 1 a 5)"
                />

                <label className="filtro-check">
                    <input
                        type="checkbox"
                        checked={soloEvaluados}
                        onChange={(e) => setSoloEvaluados(e.target.checked)}
                    />
                    Solo con nota
                </label>

                <label className="filtro-check">
                    <input
                        type="checkbox"
                        checked={soloSeleccionados}
                        onChange={(e) => setSoloSeleccionados(e.target.checked)}
                    />
                    Solo seleccionados
                </label>

                <label className="filtro-check">
                    <input
                        type="checkbox"
                        checked={soloPendientes}
                        onChange={(e) => setSoloPendientes(e.target.checked)}
                    />
                    Solo pendientes de calificar
                </label>

                {limite && verMas && postersFiltrados.length > limite && (
                    <a href="#" className="ver-mas" onClick={(e) => {
                        e.preventDefault();
                        verMas();
                    }}>
                        Ver más...
                    </a>
                )}
            </div>

            {posterEnVista && (
                <VistaPreviaPoster poster={posterEnVista} cerrarModal={() => setPosterEnVista(null)} />
            )}

            {posterAAsignar && (
                <AsignarEvaluadorModal
                    poster={posterAAsignar}
                    idRonda={rondaTrabajoId || null}
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
                <ModalEvaluacion
                    poster={posterAEvaluar}
                    criterios={criterios}
                    evaluacionInicial={evaluacionesMap[posterAEvaluar.id]}
                    idEvaluador={idUsuarioActual}
                    idRonda={rondaTrabajoId ? parseInt(rondaTrabajoId, 10) : null}
                    nombreRonda={rondaSel ? `Ronda ${rondaSel.numero} · ${rondaSel.nombre}` : null}
                    soloLectura={rondaCerrada}
                    onClose={() => setPosterAEvaluar(null)}
                    onGuardado={() => cargarCriteriosYPosters()}
                />
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
