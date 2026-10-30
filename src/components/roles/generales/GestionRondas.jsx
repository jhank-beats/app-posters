import React, { useState, useEffect, useCallback } from 'react';
import './roles.css';
import GestionCriterios from '../super_admin/GestionCriterios.jsx';
import CertificadoPremio from './CertificadoPremio.jsx';
import { tituloRonda, textoLugar } from './rondasUtils.js';
import { descargarResumenRondaPDF } from './ResumenRondaPDF.jsx';
import { descargarInformeRondaPDF } from './InformeCalificacionesPDF.jsx';
import { invalidarRondasResumen } from '../../../api/rondasResumen.js';
import { API_BASE } from '../../../config.js';
import { categoriaLegible } from '../../../categorias.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';

// GestionRondas — panel de admin / super admin para configurar rondas, cortar
// por promedio, publicar el podio y entregar premios (§6.1 del documento de
// especificación). Todos los permisos se revalidan en el backend; aquí solo se
// ocultan botones.


const GestionRondas = ({ cerrarTabla, idEventoInicial = null, idRondaFoco = null }) => {
    const [cargando, setCargando] = useState(true);
    const [eventos, setEventos] = useState([]);
    const [idEvento, setIdEvento] = useState(null);
    const [mensaje, setMensaje] = useState(null);

    // Detalle (ranking) por ronda
    const [detalles, setDetalles] = useState({});
    const [visibles, setVisibles] = useState({});
    // Configuración editable por ronda
    const [config, setConfig] = useState({});
    // Corte por ronda: la selección vive en el modal de cierre (`cierreFinal`).
    // Podio por ronda: { premios, lugares: {id: lugar}, preview }
    const [podios, setPodios] = useState({});

    const [mostrarCriterios, setMostrarCriterios] = useState(false);
    const [paraCertificados, setParaCertificados] = useState(null);
    const [confirmacion, setConfirmacion] = useState(null);
    const [formRonda, setFormRonda] = useState(null);
    const [cierreFinal, setCierreFinal] = useState(null);
    // Aviso de pósters sin calificar al intentar cerrar una ronda (mejora 2026-10).
    const [avisoPendientes, setAvisoPendientes] = useState(null);
    // Participantes por ronda (evaluadores asignados + pendientes).
    const [participantes, setParticipantes] = useState({});

    const cargarResumen = useCallback(async (mantenerEvento = null) => {
        try {
            const res = await fetch(`${API_BASE}/Rondas.php?action=resumen`);
            const data = await res.json();
            if (data.success) {
                const lista = data.data || [];
                setEventos(lista);
                setIdEvento(prev => {
                    if (mantenerEvento) return mantenerEvento;
                    if (idEventoInicial) return idEventoInicial;
                    if (prev && lista.some(e => e.id_evento === prev)) return prev;
                    const rolActual = parseInt(localStorage.getItem('id_rol') || '0', 10);
                    const carreraUsr = (localStorage.getItem('carreraUsuario') || '').toLowerCase();
                    const prefCarrera = (rolActual === 5 || carreraUsr.includes('civil')) ? 'civil' : 'sistemas';
                    const activoCarrera = lista.find(e => e.activo === 1 && (e.carrera === prefCarrera || e.carrera === 'ambas'));
                    const activo = activoCarrera || lista.find(e => e.activo === 1);
                    return (activo || lista[0] || {}).id_evento ?? null;
                });
            } else {
                setMensaje({ tipo: 'error', texto: data.message || 'No fue posible cargar las rondas.' });
            }
        } catch {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
        } finally {
            setCargando(false);
        }
    }, [idEventoInicial]);

    useEffect(() => { cargarResumen(); }, [cargarResumen]);

    // Si se llegó desde "Ver en ranking de ronda", se abre ese ranking de una vez.
    useEffect(() => {
        if (!idRondaFoco || visibles[idRondaFoco]) return;
        const existe = eventos.some(ev => (ev.rondas || []).some(r => r.id_ronda === idRondaFoco));
        if (!existe) return;
        setVisibles(prev => ({ ...prev, [idRondaFoco]: true }));
        if (detalles[idRondaFoco]) return;
        let vivo = true;
        fetch(`${API_BASE}/Rondas.php?id_ronda=${idRondaFoco}`)
            .then(res => res.json())
            .then(data => {
                if (vivo && data.success) {
                    setDetalles(prev => ({ ...prev, [idRondaFoco]: data.data }));
                }
            })
            .catch(() => { /* silencio */ });
        return () => { vivo = false; };
    }, [idRondaFoco, eventos, detalles, visibles]);

    const eventoSel = eventos.find(e => e.id_evento === idEvento) || null;
    const rondas = eventoSel ? eventoSel.rondas || [] : [];
    const esEventoCivil = (eventoSel?.carrera || '').toLowerCase().includes('civil') ||
        (eventoSel?.nombre_evento || '').toLowerCase().includes('civil');

    useEffect(() => {
        // Estado inicial de configuración y podio por ronda
        const conf = {};
        const pod = {};
        rondas.forEach(r => {
            conf[r.id_ronda] = {
                nombre: r.nombre,
                cupos: r.cupos_seleccion ?? '',
                premios: r.premios ?? 3,
                guardando: false
            };
            pod[r.id_ronda] = {
                premios: r.premios ?? 3,
                lugares: {},
                preview: null
            };
        });
        setConfig(conf);
        setPodios(pod);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEvento, eventos.length]);

    const lanzar = (tipo, texto) => setMensaje({ tipo, texto });

    // --- acciones de configuración -----------------------------------------

    const guardarConfig = async (ronda) => {
        const cfg = config[ronda.id_ronda] || {};
        setConfig(prev => ({ ...prev, [ronda.id_ronda]: { ...prev[ronda.id_ronda], guardando: true } }));
        try {
            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'actualizar_ronda',
                    id_ronda: ronda.id_ronda,
                    nombre: cfg.nombre,
                    cupos_seleccion: cfg.cupos === '' ? null : cfg.cupos,
                    premios: cfg.premios
                })
            });
            const data = await res.json();
            if (data.success) {
                lanzar('exito', 'Configuración de la ronda actualizada.');
                await cargarResumen(idEvento);
            } else {
                lanzar('error', data.message || 'No fue posible actualizar la ronda.');
            }
        } catch {
            lanzar('error', 'Error de conexión con el servidor.');
        } finally {
            setConfig(prev => ({ ...prev, [ronda.id_ronda]: { ...prev[ronda.id_ronda], guardando: false } }));
        }
    };

    const cambiarEstadoRonda = async (ronda) => {
        // Abrir sigue siendo directo; cerrar simple SOLO es cierre final.
        if (ronda.estado !== 'abierta') {
            try {
                const res = await fetch(`${API_BASE}/Rondas.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accion: 'abrir_ronda', id_ronda: ronda.id_ronda })
                });
                const data = await res.json();
                if (data.success) {
                    lanzar('exito', data.message || 'Ronda actualizada.');
                    invalidarRondasResumen();
                    await cargarResumen(idEvento);
                } else {
                    lanzar('error', data.message || 'No fue posible cambiar el estado de la ronda.');
                }
            } catch {
                lanzar('error', 'Error de conexión con el servidor.');
            }
            return;
        }
        // Ronda abierta → flujo único: modal con la previsualización del corte,
        // las casillas de quién pasa y la confirmación final (Fase 1.5).
        abrirModalCierre(ronda);
    };

    // Modal de cierre: carga la previsualización y deja marcar quién pasa.
    const abrirModalCierre = async (ronda, rehaciendo = false) => {
        const cfg = config[ronda.id_ronda] || {};
        const cupos = parseInt(cfg.cupos, 10) || 0;
        // Evaluadores por póster en la ronda siguiente: 1 si la siguiente es la
        // ronda 1 (nunca ocurre al cerrar, pero se respeta); si no, varios.
        const evaluadores = ronda.numero + 1 <= 1 ? 1 : 3;
        setCierreFinal({ ronda, cupos, seleccion: {}, cargando: true, rehaciendo, preview: null, evaluadores });

        try {
            if (rehaciendo) {
                // Corregir un corte ya hecho: parte de lo que ya está seleccionado.
                const seleccion = {};
                (detalles[ronda.id_ronda]?.ranking || []).forEach(f => {
                    if (f.seleccionado) seleccion[f.id_poster] = !!f.seleccion_manual;
                });
                setCierreFinal(prev => ({ ...prev, seleccion, cargando: false, rehaciendo: true, preview: null }));
                return;
            }

            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'previsualizar_corte', id_ronda: ronda.id_ronda, cupos })
            });
            const data = await res.json();
            if (!data.success) {
                setCierreFinal(null);
                lanzar('error', data.message || 'No fue posible previsualizar el corte.');
                return;
            }
            const seleccion = {};
            (data.data.sugeridos || []).forEach(id => { seleccion[id] = false; });
            setCierreFinal(prev => ({
                ...prev,
                cupos: data.data.cupos || prev.cupos,
                cuposPorCat: data.data.cupos_por_categoria || 3,
                seleccion,
                cargando: false,
                rehaciendo: false,
                preview: data.data,
                pendientes: data.data.pendientes || []
            }));
        } catch {
            setCierreFinal(null);
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    const recalcularCorte = async (cuposValor) => {
        if (!cierreFinal?.ronda) return;
        const esCat = !!cierreFinal.preview?.corte_por_categoria;
        const paramBody = {
            accion: 'previsualizar_corte',
            id_ronda: cierreFinal.ronda.id_ronda
        };
        if (esCat) {
            paramBody.cupos_por_categoria = Math.max(1, parseInt(cuposValor, 10) || 3);
        } else {
            paramBody.cupos = Math.max(0, parseInt(cuposValor, 10) || 0);
        }

        setCierreFinal(prev => ({ ...prev, cargando: true }));
        try {
            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paramBody)
            });
            const data = await res.json();
            if (data.success) {
                const seleccion = {};
                (data.data.sugeridos || []).forEach(id => { seleccion[id] = false; });
                setCierreFinal(prev => ({
                    ...prev,
                    cupos: data.data.cupos,
                    cuposPorCat: esCat ? paramBody.cupos_por_categoria : prev.cuposPorCat,
                    seleccion,
                    cargando: false,
                    preview: data.data,
                    pendientes: data.data.pendientes || []
                }));
            } else {
                setCierreFinal(prev => ({ ...prev, cargando: false }));
                lanzar('error', data.message || 'Error al recalcular corte.');
            }
        } catch {
            setCierreFinal(prev => ({ ...prev, cargando: false }));
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    const alternarEnModal = (idPoster, marcado) => {
        setCierreFinal(prev => {
            if (!prev) return prev;
            const seleccion = { ...(prev.seleccion || {}) };
            if (marcado) {
                seleccion[idPoster] = true; // agregado a mano
            } else {
                delete seleccion[idPoster];
            }
            return { ...prev, seleccion };
        });
    };

    // Ejecuta el cierre final (sin pasar pósters). Mismo aviso de pendientes.
    const ejecutarCierreFinal = async (ronda, forzar = false) => {
        try {
            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'cerrar_ronda',
                    id_ronda: ronda.id_ronda,
                    confirmar_cierre_final: true,
                    ...(forzar ? { forzar_cierre_pendientes: true } : {})
                })
            });
            const data = await res.json();
            if (data.success) {
                lanzar('exito', data.message || 'Ronda cerrada.');
                setAvisoPendientes(null);
                invalidarRondasResumen();
                await cargarResumen(idEvento);
            } else if (data.tipo === 'pendientes_sin_calificar') {
                setAvisoPendientes({ pendientes: data.pendientes || [], total: data.pendientes_total || 0, rondaFinal: ronda });
            } else {
                lanzar('error', data.message || 'No fue posible cerrar la ronda.');
            }
        } catch {
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    // Cierre final sin pasar nada (última ronda): exige confirmación explícita.
    const cerrarSinPasar = (ronda) => {
        setConfirmacion({
            titulo: 'Cerrar ronda final',
            texto: 'Se cerrará la ronda SIN pasar pósters a ninguna siguiente. Úsalo solo en la última ronda. ¿Continuar?',
            accion: async () => {
                await ejecutarCierreFinal(ronda, false);
            }
        });
    };

    const cargarParticipantes = async (ronda) => {
        try {
            const res = await fetch(`${API_BASE}/Rondas.php?action=participantes&id_ronda=${ronda.id_ronda}`);
            const data = await res.json();
            if (data.success) {
                setParticipantes(prev => ({ ...prev, [ronda.id_ronda]: data.data || [] }));
            }
        } catch { /* silencio */ }
    };

    const descargarPDF = async (ronda) => {
        try {
            await descargarResumenRondaPDF(ronda.id_ronda);
        } catch {
            lanzar('error', 'No fue posible generar el PDF del resumen.');
        }
    };

    // Informe con las notas INDIVIDUALES de cada evaluador y el promedio.
    const descargarInforme = async (ronda) => {
        try {
            await descargarInformeRondaPDF(ronda.id_ronda);
        } catch {
            lanzar('error', 'No fue posible generar el informe de calificaciones.');
        }
    };

    const crearRonda = async (form) => {
        try {
            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'crear_ronda',
                    id_evento: idEvento,
                    nombre: form.nombre,
                    cupos_seleccion: form.cupos === '' ? null : form.cupos,
                    premios: form.premios
                })
            });
            const data = await res.json();
            if (data.success) {
                lanzar('exito', 'Ronda creada correctamente.');
                setFormRonda(null);
                await cargarResumen(idEvento);
            } else {
                lanzar('error', data.message || 'No fue posible crear la ronda.');
            }
        } catch {
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    // --- ranking ------------------------------------------------------------

    const cargarDetalleRonda = async (idRonda) => {
        try {
            const res = await fetch(`${API_BASE}/Rondas.php?id_ronda=${idRonda}`);
            const data = await res.json();
            if (data.success) {
                setDetalles(prev => ({ ...prev, [idRonda]: data.data }));
            } else {
                lanzar('error', data.message || 'No fue posible cargar el ranking.');
            }
        } catch {
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    // El detalle se carga al abrir el panel: la tarjeta muestra los conteos
    // reales y la tabla del ranking se despliega con "Ver ranking".
    useEffect(() => {
        rondas.forEach(r => {
            if (!detalles[r.id_ronda]) cargarDetalleRonda(r.id_ronda);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rondas]);

    const verRanking = (ronda) => {
        setVisibles(prev => ({ ...prev, [ronda.id_ronda]: !prev[ronda.id_ronda] }));
    };

    // --- corte --------------------------------------------------------------

    const rehacerSeleccion = (ronda) => {
        // Corrección de un corte ya confirmado: mismo modal, en modo "rehacer".
        abrirModalCierre(ronda, true);
    };

    // Ejecuta el corte. Si el servidor responde "pendientes_sin_calificar" se
    // abre el modal de aviso con la lista de títulos; solo se cierra si el
    // admin lo fuerza explícitamente (forzar = true).
    const ejecutarCorte = async (estado, forzar = false) => {
        const ronda = estado.ronda;
        const ids = Object.keys(estado.seleccion || {}).map(id => parseInt(id, 10));
        const manuales = Object.entries(estado.seleccion || {})
            .filter(([, manual]) => manual)
            .map(([id]) => parseInt(id, 10));
        const numEval = Math.max(1, Math.min(5, parseInt(estado.evaluadores, 10) || 3));

        try {
            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: estado.rehaciendo ? 'corregir_seleccion' : 'cerrar_y_pasar',
                    id_ronda: ronda.id_ronda,
                    cupos: estado.cupos,
                    ids_seleccionados: ids,
                    manuales,
                    evaluadores_siguiente: numEval,
                    ...(forzar ? { forzar_cierre_pendientes: true } : {}),
                    nombre_siguiente: `Ronda ${ronda.numero + 1} · Exposición ante el auditorio`,
                    premios_siguiente: config[ronda.id_ronda]?.premios ?? ronda.premios ?? 3
                })
            });
            const data = await res.json();
            if (data.success) {
                const sinEval = data.data?.sin_evaluadores || [];
                const porPoster = data.data?.evaluadores_por_poster || numEval;
                let aviso = `${data.message || 'Corte confirmado'} — ${data.data?.autores_avisados || 0} autor(es) y ${data.data?.evaluadores_avisados || 0} evaluador(es) avisados (${porPoster} por póster).`;
                if (sinEval.length > 0) {
                    aviso += ` ⚠️ ${sinEval.length} póster(s) quedaron sin evaluadores disponibles: asígnalos manualmente desde la tabla de pósters.`;
                }
                if (data.data?.sin_criterios) {
                    aviso += ' ⚠️ La ronda siguiente quedó SIN criterios: créalos desde "Cambiar criterios" antes de calificar.';
                }
                lanzar(sinEval.length > 0 ? 'aviso' : 'exito', aviso);
                setCierreFinal(null);
                setAvisoPendientes(null);
                invalidarRondasResumen();
                await cargarResumen(idEvento);
                setDetalles(prev => { const c = { ...prev }; delete c[ronda.id_ronda]; return c; });
            } else if (data.tipo === 'pendientes_sin_calificar') {
                // Bloqueo: faltan pósters por calificar. Se muestra la lista.
                setCierreFinal(null);
                setAvisoPendientes({ estado, pendientes: data.pendientes || [], total: data.pendientes_total || 0 });
            } else {
                lanzar('error', data.message || 'No fue posible confirmar el corte.');
            }
        } catch {
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    const confirmarCorte = () => {
        const estado = cierreFinal;
        if (!estado) return;
        const ronda = estado.ronda;
        const ids = Object.keys(estado.seleccion || {}).map(id => parseInt(id, 10));
        if (ids.length === 0) {
            lanzar('error', 'Debes seleccionar al menos un póster para pasar a la siguiente ronda. Si es la última ronda, usa "Cerrar sin pasar (final)".');
            return;
        }
        const numEval = Math.max(1, Math.min(5, parseInt(estado.evaluadores, 10) || 3));
        const pendientes = estado.pendientes || [];
        setConfirmacion({
            titulo: estado.rehaciendo ? 'Guardar selección corregida' : 'Cerrar ronda y pasar a la siguiente',
            texto: estado.rehaciendo
                ? `Se actualizará la selección de la Ronda ${ronda.numero + 1}: quedarán ${ids.length} póster(s) con ${numEval} evaluador(es) cada uno. Los pósters que salgan dejarán de tener evaluadores asignados. ¿Continuar?`
                : `Se cerrará la ${tituloRonda(ronda)}, ${ids.length} póster(s) pasan a la Ronda ${ronda.numero + 1} con ${numEval} evaluador(es) cada uno, sorteados al azar (distintos a quienes ya calificaron cada póster). Se avisará por correo a autores y nuevos evaluadores.`
                + (pendientes.length > 0
                    ? ` ⚠️ Atención: faltan ${pendientes.length} pósters por calificar.`
                    : '')
                + ' ¿Continuar?',
            accion: async () => {
                setCierreFinal(null);
                await ejecutarCorte(estado, false);
            }
        });
    };

    // --- podio --------------------------------------------------------------

    const previsualizarPodio = async (ronda) => {
        const pod = podios[ronda.id_ronda] || {};
        const premios = parseInt(pod.premios, 10) || 1;
        try {
            const res = await fetch(`${API_BASE}/Rondas.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'previsualizar_podio', id_ronda: ronda.id_ronda, premios })
            });
            const data = await res.json();
            if (!data.success) {
                lanzar('error', data.message || 'No fue posible previsualizar el podio.');
                return;
            }
            const lugares = {};
            (data.data.lista || []).forEach(f => {
                if (f.lugar_sugerido) lugares[f.id_poster] = f.lugar_sugerido;
            });
            setPodios(prev => ({ ...prev, [ronda.id_ronda]: { ...prev[ronda.id_ronda], premios, lugares, preview: data.data } }));
        } catch {
            lanzar('error', 'Error de conexión con el servidor.');
        }
    };

    const publicarPodio = (ronda) => {
        const pod = podios[ronda.id_ronda] || {};
        const premios = parseInt(pod.premios, 10) || 1;
        const lugares = Object.entries(pod.lugares || {})
            .filter(([, lugar]) => lugar)
            .map(([id, lugar]) => ({ id_poster: parseInt(id, 10), lugar: parseInt(lugar, 10) }));
        if (lugares.length === 0) {
            lanzar('aviso', 'Marca al menos un lugar antes de publicar el podio.');
            return;
        }
        setConfirmacion({
            titulo: 'Publicar podio',
            texto: `Se publicarán ${lugares.length} premio(s) de esta ronda y se avisará por correo a los ganadores y a los evaluadores. ¿Continuar?`,
            accion: async () => {
                try {
                    const res = await fetch(`${API_BASE}/Rondas.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accion: 'publicar_podio', id_ronda: ronda.id_ronda, premios, lugares })
                    });
                    const data = await res.json();
                    if (data.success) {
                        lanzar('exito', 'Podio publicado. Los ganadores ya pueden descargar su certificado.');
                        invalidarRondasResumen();
                        await cargarResumen(idEvento);
                        setDetalles(prev => { const c = { ...prev }; delete c[ronda.id_ronda]; return c; });
                    } else {
                        lanzar('error', data.message || 'No fue posible publicar el podio.');
                    }
                } catch {
                    lanzar('error', 'Error de conexión con el servidor.');
                }
            }
        });
    };

    const deshacerPodio = (ronda) => {
        setConfirmacion({
            titulo: 'Deshacer podio',
            texto: 'Se quitarán los lugares y premios publicados y la ronda volverá a abrirse. ¿Continuar?',
            accion: async () => {
                try {
                    const res = await fetch(`${API_BASE}/Rondas.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accion: 'deshacer_podio', id_ronda: ronda.id_ronda })
                    });
                    const data = await res.json();
                    if (data.success) {
                        lanzar('exito', 'Podio deshecho.');
                        invalidarRondasResumen();
                        await cargarResumen(idEvento);
                        setDetalles(prev => { const c = { ...prev }; delete c[ronda.id_ronda]; return c; });
                    } else {
                        lanzar('error', data.message || 'No fue posible deshacer el podio.');
                    }
                } catch {
                    lanzar('error', 'Error de conexión con el servidor.');
                }
            }
        });
    };

    // --- render -------------------------------------------------------------

    const renderTarjeta = (ronda) => {
        const cfg = config[ronda.id_ronda] || { nombre: ronda.nombre, cupos: ronda.cupos_seleccion ?? '', premios: ronda.premios ?? 3 };
        const detalle = detalles[ronda.id_ronda];
        const abiertoRanking = !!visibles[ronda.id_ronda];
        const pod = podios[ronda.id_ronda] || {};
        const ranking = detalle?.ranking || [];
        const conNota = ranking.filter(f => f.n_evaluaciones > 0).length;
        const sinNota = ranking.length - conNota;
        const abierta = ronda.estado === 'abierta';
        const conSeleccion = ronda.n_selecciones > 0;
        const conGanadores = (ronda.ganadores || []).length > 0;
        const corteConfirmado = Number(ronda.corte_confirmado || 0) === 1;
        const listaParticipantes = participantes[ronda.id_ronda] || null;

        return (
            <article className="tarjeta-ronda" key={ronda.id_ronda}>
                <header className="ronda-cabecera">
                    <div className="ronda-titulo">
                        <h3>{tituloRonda(ronda)}</h3>
                        <p className="ronda-criterios">
                            Criterios: {ronda.criterios && ronda.criterios.length > 0
                                ? ronda.criterios.map(c => c.nombre).join(', ')
                                : 'sin criterios configurados'}
                            {' · '}
                            <button type="button" className="enlace-accion" onClick={() => setMostrarCriterios(true)}>
                                (ver / editar)
                            </button>
                        </p>
                    </div>
                    <span className={`badge-rol ${abierta ? 'rol-2' : 'rol-3'}`}>{abierta ? 'ABIERTA' : 'CERRADA'}</span>
                    {!abierta && (
                        <span className={`badge-rol ${corteConfirmado ? 'rol-2' : 'rol-1'}`} title={corteConfirmado ? 'Se confirmó el corte a la siguiente ronda' : 'Se cerró sin pasar pósters'}>
                            {corteConfirmado ? 'CORTE CONFIRMADO' : 'CERRADA SIN CORTE'}
                        </span>
                    )}
                </header>

                <div className="ronda-config">
                    {!esEventoCivil && (
                        <label className="campo-ronda">
                            <span>Cupos para la siguiente ronda</span>
                            <input
                                type="number" min="0" className="input-filtro"
                                value={cfg.cupos}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    [ronda.id_ronda]: { ...prev[ronda.id_ronda], cupos: e.target.value }
                                }))}
                            />
                        </label>
                    )}
                    <label className="campo-ronda">
                        <span>Premios</span>
                        <input
                            type="number" min="1" max="20" className="input-filtro"
                            value={cfg.premios}
                            onChange={(e) => setConfig(prev => ({
                                ...prev,
                                [ronda.id_ronda]: { ...prev[ronda.id_ronda], premios: e.target.value }
                            }))}
                        />
                    </label>
                    <label className="campo-ronda campo-ronda-nombre">
                        <span>Nombre de la ronda</span>
                        <input
                            type="text" className="input-filtro"
                            value={cfg.nombre}
                            onChange={(e) => setConfig(prev => ({
                                ...prev,
                                [ronda.id_ronda]: { ...prev[ronda.id_ronda], nombre: e.target.value }
                            }))}
                        />
                    </label>
                    <button
                        className="boton-secundario"
                        style={{ minHeight: '40px' }}
                        disabled={cfg.guardando || !abierta}
                        onClick={() => guardarConfig(ronda)}
                    >
                        {cfg.guardando ? 'Guardando…' : 'Guardar configuración'}
                    </button>
                </div>

                <div className="ronda-stats">
                    <span><strong>{conNota}</strong> de <strong>{ranking.length || '—'}</strong> pósters evaluados</span>
                    <span>{sinNota} sin nota</span>
                    <span>{ronda.n_evaluaciones} evaluaciones guardadas</span>
                    <span>{ronda.n_selecciones} pósters seleccionados</span>
                    {conGanadores && <span className="ronda-premios">{ronda.n_ganadores} ganadores</span>}
                </div>

                <div className="ronda-acciones">
                    <button className="boton-primario" onClick={() => verRanking(ronda)}>
                        {abiertoRanking ? 'Ocultar ranking' : 'Ver ranking'}
                    </button>
                    <button className="boton-secundario" onClick={() => setMostrarCriterios(true)}>Cambiar criterios</button>
                    {abierta ? (
                        !esEventoCivil && (
                            <button className="boton-primario" onClick={() => cambiarEstadoRonda(ronda)}>
                                Cerrar ronda y pasar a la siguiente
                            </button>
                        )
                    ) : (
                        <button className="boton-secundario" onClick={() => cambiarEstadoRonda(ronda)}>
                            Abrir ronda
                        </button>
                    )}
                    {abierta && (
                        <button className={esEventoCivil ? "boton-primario" : "boton-secundario"} onClick={() => cerrarSinPasar(ronda)} title="Solo para la última ronda">
                            {esEventoCivil ? 'Cerrar ronda (ronda única)' : 'Cerrar sin pasar (final)'}
                        </button>
                    )}
                    {!abierta && (
                        <button className="boton-secundario" onClick={() => descargarPDF(ronda)}>
                            📄 PDF resumen
                        </button>
                    )}
                    <button className="boton-secundario" onClick={() => descargarInforme(ronda)} title="Notas individuales de cada evaluador y el promedio del póster">
                        📋 Informe detallado
                    </button>
                    <button className="boton-secundario" onClick={() => cargarParticipantes(ronda)}>
                        👥 Evaluadores
                    </button>
                </div>

                {listaParticipantes && (
                    <div className="ronda-stats" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                        {listaParticipantes.length === 0 && <span>Sin evaluadores asignados en esta ronda.</span>}
                        {listaParticipantes.map(p => (
                            <span key={p.id}>👤 {p.nombres} {p.apellidos} · {p.n_asignados} asignados · {p.n_calificados ?? '?'} calificados · <strong>{p.n_pendientes ?? '?'} pendientes</strong></span>
                        ))}
                    </div>
                )}

                {detalle && abiertoRanking && (
                    <div className="ronda-ranking">
                        {!esEventoCivil && (
                            <div className="barra-corte">
                                <label className="campo-ronda">
                                    <span>{ronda.numero === 1 ? 'Cupos totales (3 por cat.)' : 'Cupos'}</span>
                                    <input
                                        type="number" min="0" className="input-filtro"
                                        value={cfg.cupos}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            [ronda.id_ronda]: { ...prev[ronda.id_ronda], cupos: e.target.value }
                                        }))}
                                    />
                                </label>
                                {abierta && (
                                    <button className="boton-primario" onClick={() => abrirModalCierre(ronda)}>
                                        Cerrar ronda y pasar a la siguiente
                                    </button>
                                )}
                                {!abierta && conSeleccion && (
                                    <button className="boton-secundario" onClick={() => rehacerSeleccion(ronda)}>
                                        Rehacer selección
                                    </button>
                                )}
                                {!abierta && !conSeleccion && (
                                    <span className="subtexto-celda">
                                        Esta ronda no tiene corte: se cerró sin pasar pósters.
                                    </span>
                                )}
                            </div>
                        )}

                        {!esEventoCivil && ronda.numero === 1 && (
                            <div style={{
                                background: '#eef7fa',
                                border: '1px solid #bce1ec',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                margin: '8px 0 12px',
                                fontSize: '13px',
                                color: '#132740',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap'
                            }}>
                                <span>🎯 <strong>Regla de clasificación Ronda 1 → Ronda 2:</strong> Pasan los <strong>3 primeros pósters por promedio de cada categoría</strong> (9 pósters en total para 3 categorías).</span>
                            </div>
                        )}

                        <div className="contenedor-tabla">
                          <HintScrollTabla />
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Póster</th>
                                        <th>Categoría</th>
                                        <th>Promedio</th>
                                        <th>Evaluaciones</th>
                                        <th>Estado</th>
                                        <th>Seleccionado</th>
                                        <th>Lugar / Premio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking.length === 0 && (
                                        <tr><td colSpan={8} style={{ textAlign: 'center' }}>No hay pósters en esta ronda.</td></tr>
                                    )}
                                    {ranking.map((fila, indice) => (
                                        <tr key={fila.id_poster}>
                                            <td style={{ fontWeight: 700, color: '#00acc9' }}>{indice + 1}</td>
                                            <td>
                                                <strong style={{ color: '#132740' }}>{fila.titulo}</strong>
                                                <div className="subtexto-celda">{fila.autores}{fila.nombre_autor ? ` · ${fila.nombre_autor}` : ''}</div>
                                            </td>
                                            <td>
                                                <span className="badge-rol rol-3" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                    {categoriaLegible(fila.categoria) || '—'}
                                                </span>
                                                {fila.posicion_categoria && (
                                                    <div className="subtexto-celda" style={{ fontWeight: 600, color: fila.posicion_categoria <= 3 ? '#28a745' : '#5f5e5e' }}>
                                                        #{fila.posicion_categoria} en categoría
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="promedio-ronda">{fila.promedio ?? '—'}</span>
                                                {fila.seleccion_manual && fila.seleccionado && <div className="subtexto-celda">selección manual</div>}
                                            </td>
                                            <td>{fila.n_evaluaciones} {fila.n_asignados > 0 ? `de ${fila.n_asignados}` : ''}</td>
                                            <td>
                                                <span className={`badge-rol ${fila.n_evaluaciones === 0 ? 'rol-1' : (fila.pendientes > 0 ? 'rol-4' : 'rol-2')}`}>
                                                    {fila.estado_evaluacion}
                                                </span>
                                            </td>
                                            <td>
                                                {fila.seleccionado
                                                    ? <span className="badge-rol rol-2">Seleccionado</span>
                                                    : (fila.en_corte_categoria && abierta
                                                        ? <span className="badge-rol rol-4" title="Clasifica entre los 3 primeros de su categoría">En corte (Top 3 cat.)</span>
                                                        : <span className="subtexto-celda">—</span>)}
                                            </td>
                                            <td>
                                                {fila.lugar
                                                    ? <span className="badge-premio">{textoLugar(fila.lugar, fila.premio)}</span>
                                                    : <span className="subtexto-celda">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Podio de la ronda */}
                        {(ronda.numero > 1 || esEventoCivil || conGanadores) && (
                            <div className="podio-seccion">
                                <h4>🏆 Podio de la {ronda.nombre} — {pod.premios} premio(s)</h4>
                                <div className="barra-corte">
                                    <label className="campo-ronda">
                                        <span>Número de premios</span>
                                        <input
                                            type="number" min="1" max="20" className="input-filtro"
                                            value={pod.premios}
                                            onChange={(e) => setPodios(prev => ({
                                                ...prev,
                                                [ronda.id_ronda]: { ...prev[ronda.id_ronda], premios: e.target.value }
                                            }))}
                                        />
                                    </label>
                                    <button className="boton-primario" onClick={() => previsualizarPodio(ronda)}>
                                        Previsualizar podio
                                    </button>
                                    {conGanadores && (
                                        <button className="boton-secundario" onClick={() => deshacerPodio(ronda)}>
                                            Deshacer podio
                                        </button>
                                    )}
                                    {pod.preview?.empate && (
                                        <span className="nota-empate">⚠️ {pod.preview.motivo_empate}</span>
                                    )}
                                </div>

                                {pod.preview && (
                                    <>
                                        <div className="contenedor-tabla">
                                          <HintScrollTabla />
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Póster</th>
                                                        <th>Promedio</th>
                                                        <th>Lugar</th>
                                                        <th>Premio</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(pod.preview.lista || []).map(fila => (
                                                        <tr key={fila.id_poster}>
                                                            <td><strong style={{ color: '#132740' }}>{fila.titulo}</strong></td>
                                                            <td><span className="promedio-ronda">{fila.promedio ?? '—'}</span></td>
                                                            <td>
                                                                <select
                                                                    className="input-filtro"
                                                                    value={(pod.lugares || {})[fila.id_poster] || ''}
                                                                    onChange={(e) => setPodios(prev => {
                                                                        const lugares = { ...(prev[ronda.id_ronda].lugares || {}) };
                                                                        if (e.target.value) {
                                                                            lugares[fila.id_poster] = parseInt(e.target.value, 10);
                                                                        } else {
                                                                            delete lugares[fila.id_poster];
                                                                        }
                                                                        return { ...prev, [ronda.id_ronda]: { ...prev[ronda.id_ronda], lugares } };
                                                                    })}
                                                                >
                                                                    <option value="">Sin premio</option>
                                                                    {Array.from({ length: pod.premios }, (_, i) => (
                                                                        <option key={i + 1} value={i + 1}>{textoLugar(i + 1)}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td>
                                                                <span className="badge-premio">
                                                                    {textoLugar((pod.lugares || {})[fila.id_poster], fila.premio)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="acciones-corte">
                                            <span>Al publicar, los ganadores y los evaluadores reciben un correo.</span>
                                            <button className="boton-primario" onClick={() => publicarPodio(ronda)}>
                                                Publicar podio
                                            </button>
                                        </div>
                                    </>
                                )}

                                {conGanadores && (
                                    <div className="ganadores-lista">
                                        {ronda.ganadores.map(g => (
                                            <div className="ganador-fila" key={g.id_poster}>
                                                <span className="badge-premio">{textoLugar(g.lugar, g.premio)}</span>
                                                <span className="ganador-texto">
                                                    <strong>{g.titulo}</strong>
                                                    <span className="subtexto-celda">{g.nombre_autor || g.autores}</span>
                                                </span>
                                                <button
                                                    className="boton-primario"
                                                    onClick={() => setParaCertificados({ ganadores: [g], evento: eventoSel })}
                                                >
                                                    📜 Certificado
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            className="boton-secundario"
                                            style={{ minHeight: '40px' }}
                                            onClick={() => setParaCertificados({ ganadores: ronda.ganadores, evento: eventoSel })}
                                        >
                                            📥 Descargar todos los certificados
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </article>
        );
    };

    return (
        <div className="formularios formularios-rondas">
            {cerrarTabla && <button className="cerrar-formulario" onClick={cerrarTabla} aria-label="Cerrar">X</button>}
            <div className="formularios-header">
                <span className="formularios-eyebrow">Rondas y premios</span>
                <h2>🏆 Rondas de Evaluación y Premios</h2>
                <p>Configura cada ronda, corta por promedio, publica el podio y entrega los certificados.</p>
            </div>

            {mensaje && <div className={`alerta alerta-${mensaje.tipo}`}>{mensaje.texto}</div>}

            <div className="filtros">
                <select
                    className="input-filtro"
                    value={idEvento ?? ''}
                    onChange={(e) => setIdEvento(parseInt(e.target.value, 10))}
                    aria-label="Seleccionar evento"
                >
                    {eventos.map(ev => (
                        <option key={ev.id_evento} value={ev.id_evento}>
                            {ev.nombre_evento} {ev.codigo_evento ? `(${ev.codigo_evento})` : ''}{ev.activo === 1 ? ' · activo' : ''}
                        </option>
                    ))}
                </select>
                {(!esEventoCivil || rondas.length === 0) ? (
                    <button className="boton-primario" style={{ minHeight: '40px' }} onClick={() => setFormRonda({ nombre: '', cupos: '', premios: 3 })}>
                        + Crear ronda
                    </button>
                ) : (
                    <span className="badge-evento" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        🏗️ Ingeniería Civil · Modalidad de 1 única ronda
                    </span>
                )}
            </div>

            {cargando && <p style={{ textAlign: 'center', padding: '1.5rem' }}>Cargando rondas…</p>}

            {!cargando && rondas.length === 0 && (
                <p style={{ textAlign: 'center', padding: '1.5rem', color: '#5f5e5e' }}>
                    Este evento todavía no tiene rondas. Crea la primera para comenzar.
                </p>
            )}

            <div className="rondas-lista">
                {rondas.map(renderTarjeta)}
            </div>

            {mostrarCriterios && (
                <div className="modal">
                    <GestionCriterios cerrarTabla={() => { setMostrarCriterios(false); cargarResumen(idEvento); }} />
                </div>
            )}

            {paraCertificados && (
                <CertificadoPremio
                    ganadores={paraCertificados.ganadores}
                    evento={paraCertificados.evento}
                    cerrarModal={() => setParaCertificados(null)}
                />
            )}

            {cierreFinal && (() => {
                const rondaC = cierreFinal.ronda;
                const rankingC = detalles[rondaC.id_ronda]?.ranking || [];
                const seleccionadas = Object.keys(cierreFinal.seleccion || {});
                const enCierre = new Set(seleccionadas.map(id => parseInt(id, 10)));
                return (
                    <div className="modal" onClick={() => setCierreFinal(null)}>
                        <section className="formularios" style={{ maxWidth: '820px' }} onClick={e => e.stopPropagation()}>
                            <button className="cerrar-formulario" onClick={() => setCierreFinal(null)}>X</button>
                            <div className="formularios-header">
                                <span className="formularios-eyebrow">{cierreFinal.rehaciendo ? 'Corrección de selección' : 'Cierre de ronda'}</span>
                                <h2>{cierreFinal.rehaciendo ? 'Rehacer selección' : `Cerrar ${tituloRonda(rondaC)} y pasar a la siguiente`}</h2>
                                <p>
                                    {cierreFinal.rehaciendo
                                        ? `Se actualizará la selección de la Ronda ${rondaC.numero + 1}. Los pósters que quiten dejarán de tener evaluadores.`
                                        : `La ${tituloRonda(rondaC)} se cerrará y los pósters marcados pasarán a la Ronda ${rondaC.numero + 1}, con evaluadores reasignados al azar (distintos a quienes ya calificaron cada póster).`}
                                </p>
                                {cierreFinal.preview?.empate && (
                                    <p className="nota-empate">⚠️ {cierreFinal.preview.motivo_empate}</p>
                                )}
                            </div>
                            <div className="formularios-body">
                                {cierreFinal.cargando && <p>Cargando previsualización del corte…</p>}
                                {!cierreFinal.cargando && (
                                    <>
                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
                                            {cierreFinal.preview?.corte_por_categoria ? (
                                                <>
                                                    <label className="campo-ronda" style={{ flex: '1 1 180px', maxWidth: '220px' }}>
                                                        <span>Cupos por categoría</span>
                                                        <input
                                                            type="number" min="1" max="20" className="input-filtro"
                                                            value={cierreFinal.cuposPorCat ?? 3}
                                                            onChange={(e) => setCierreFinal(prev => ({ ...prev, cuposPorCat: e.target.value }))}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="boton-secundario"
                                                        style={{ minHeight: '38px', padding: '0 14px', marginBottom: '2px' }}
                                                        onClick={() => recalcularCorte(cierreFinal.cuposPorCat ?? 3)}
                                                        title="Recalcular los mejores por promedio de cada categoría con estos cupos"
                                                    >
                                                        🔄 Recalcular sugeridos
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <label className="campo-ronda" style={{ flex: '1 1 200px', maxWidth: '260px' }}>
                                                        <span>Cupos sugeridos</span>
                                                        <input
                                                            type="number" min="0" className="input-filtro"
                                                            value={cierreFinal.cupos}
                                                            onChange={(e) => setCierreFinal(prev => ({ ...prev, cupos: e.target.value }))}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="boton-secundario"
                                                        style={{ minHeight: '38px', padding: '0 14px', marginBottom: '2px' }}
                                                        onClick={() => recalcularCorte(cierreFinal.cupos)}
                                                        title="Recalcular sugeridos según los cupos"
                                                    >
                                                        🔄 Recalcular
                                                    </button>
                                                </>
                                            )}
                                            <label className="campo-ronda" style={{ flex: '1 1 220px', maxWidth: '280px' }}>
                                                <span>Evaluadores por póster (siguiente)</span>
                                                <input
                                                    type="number" min="1" max="5" className="input-filtro"
                                                    value={cierreFinal.evaluadores ?? 3}
                                                    onChange={(e) => setCierreFinal(prev => ({ ...prev, evaluadores: e.target.value }))}
                                                />
                                            </label>
                                        </div>

                                        {cierreFinal.preview?.corte_por_categoria && (
                                            <div style={{
                                                background: '#eef7fa',
                                                border: '1px solid #bce1ec',
                                                borderRadius: '8px',
                                                padding: '8px 12px',
                                                marginBottom: '10px',
                                                fontSize: '13px',
                                                color: '#132740'
                                            }}>
                                                🎯 <strong>Corte por categoría:</strong> Se sugieren automáticamente los <strong>3 primeros pósters por promedio</strong> de cada categoría (hasta 9 pósters en 3 categorías).
                                            </div>
                                        )}

                                        {cierreFinal.preview?.resumen_categorias && Object.keys(cierreFinal.preview.resumen_categorias).length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                                {Object.entries(cierreFinal.preview.resumen_categorias).map(([catKey, catInf]) => (
                                                    <span
                                                        key={catKey}
                                                        className="badge-rol rol-3"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '12px' }}
                                                    >
                                                        <strong>{categoriaLegible(catKey)}:</strong>
                                                        <span>{catInf.clasificados} sugeridos (de {catInf.total})</span>
                                                        {catInf.empate && <strong style={{ color: '#d9534f' }}>⚠️ Empate</strong>}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <p className="subtexto-celda" style={{ marginBottom: '10px' }}>
                                            La nota que verá el autor es el <strong>promedio entre todos los evaluadores</strong> de cada póster.
                                        </p>
                                        {(cierreFinal.pendientes || []).length > 0 && (
                                            <div style={{
                                                border: '2px solid #b26a00', background: 'rgba(178,106,0,0.08)',
                                                borderRadius: '8px', padding: '10px 12px', marginBottom: '12px'
                                            }}>
                                                <strong style={{ color: '#b26a00' }}>
                                                    ⚠️ Faltan {cierreFinal.pendientes.length} pósters por calificar en esta ronda
                                                </strong>
                                                <p style={{ margin: '4px 0 8px', fontSize: '13px' }}>
                                                    No podrás cerrarla hasta calificarlos o forzar el cierre (quedarán sin nota en esta ronda):
                                                </p>
                                                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                                                    {cierreFinal.pendientes.map(p => (
                                                        <li key={p.id_poster}>
                                                            <strong>{p.titulo}</strong>
                                                            {' — '}{p.sin_evaluadores ? 'sin evaluadores asignados' : `${p.evaluado_de} evaluaciones`}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {rankingC.length === 0 && <p>No hay pósters en esta ronda.</p>}
                                        {rankingC.length > 0 && (
                                            <div className="contenedor-tabla tabla-cierre-posters">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Pasar</th>
                                                            <th>Póster</th>
                                                            <th>Categoría</th>
                                                            <th>Promedio</th>
                                                            <th>Evaluaciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rankingC.map(fila => (
                                                            <tr key={fila.id_poster} className={enCierre.has(fila.id_poster) ? 'fila-seleccionada' : ''}>
                                                                <td>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={enCierre.has(fila.id_poster)}
                                                                        onChange={(e) => alternarEnModal(fila.id_poster, e.target.checked)}
                                                                        aria-label={`Incluir ${fila.titulo} en la Ronda ${rondaC.numero + 1}`}
                                                                    />
                                                                </td>
                                                                <td>
                                                                    <strong style={{ color: '#132740' }}>{fila.titulo}</strong>
                                                                    <div className="subtexto-celda">{fila.autores}</div>
                                                                </td>
                                                                <td>
                                                                    <span className="badge-rol rol-3" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                        {categoriaLegible(fila.categoria) || '—'}
                                                                    </span>
                                                                    {fila.posicion_categoria && (
                                                                        <div className="subtexto-celda" style={{ fontWeight: 600, color: fila.posicion_categoria <= 3 ? '#28a745' : '#5f5e5e' }}>
                                                                            #{fila.posicion_categoria} en categoría
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td><span className="promedio-ronda">{fila.promedio ?? '—'}</span></td>
                                                                <td>{fila.n_evaluaciones}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        <div className="acciones-corte">
                                            <span>
                                                Pasarán <strong>{seleccionadas.length}</strong> póster(es) a la Ronda {rondaC.numero + 1}.
                                                {seleccionadas.length === 0 && ' ⚠️ Debes marcar al menos un póster para poder cerrar.'}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-acciones">
                                <button className="btn-cancelar" onClick={() => setCierreFinal(null)}>Cancelar</button>
                                <button
                                    className="btn-guardar"
                                    disabled={cierreFinal.cargando || seleccionadas.length === 0}
                                    onClick={() => confirmarCorte()}
                                >
                                    {cierreFinal.rehaciendo ? 'Guardar selección' : 'Cerrar y pasar'}
                                </button>
                            </div>
                        </section>
                    </div>
                );
            })()}

            {/* Aviso de pósters sin calificar: bloquea el cierre salvo forzado */}
            {avisoPendientes && (
                <div className="modal" onClick={() => setAvisoPendientes(null)}>
                    <section className="formularios" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
                        <button className="cerrar-formulario" onClick={() => setAvisoPendientes(null)}>X</button>
                        <div className="formularios-header">
                            <span className="formularios-eyebrow">Atención</span>
                            <h2>⚠️ Faltan {avisoPendientes.total} pósters por calificar</h2>
                            <p>
                                La ronda no se puede cerrar mientras haya pósters sin calificar.
                                Si cierras de todos modos, quedarán <strong>sin nota en esta ronda</strong>.
                            </p>
                        </div>
                        <div className="formularios-body">
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                                {avisoPendientes.pendientes.map(p => (
                                    <li key={p.id_poster} style={{ marginBottom: '6px' }}>
                                        <strong>{p.titulo}</strong>
                                        <div className="subtexto-celda">
                                            {p.sin_evaluadores
                                                ? 'Sin evaluadores asignados'
                                                : `Calificado por ${p.evaluado_de} evaluadores · faltan ${p.faltan}`}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="modal-acciones">
                            <button className="btn-cancelar" onClick={() => setAvisoPendientes(null)}>Cancelar</button>
                            <button
                                className="btn-guardar"
                                onClick={async () => {
                                    const pend = avisoPendientes;
                                    setAvisoPendientes(null);
                                    if (pend.estado) {
                                        await ejecutarCorte(pend.estado, true);
                                    } else if (pend.rondaFinal) {
                                        await ejecutarCierreFinal(pend.rondaFinal, true);
                                    }
                                }}
                            >
                                Cerrar de todos modos
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {confirmacion && (
                <div className="modal" onClick={() => setConfirmacion(null)}>
                    <section className="formularios" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
                        <button className="cerrar-formulario" onClick={() => setConfirmacion(null)}>X</button>
                        <div className="formularios-header">
                            <span className="formularios-eyebrow">Confirmación</span>
                            <h2>{confirmacion.titulo}</h2>
                            <p>{confirmacion.texto}</p>
                        </div>
                        <div className="modal-acciones">
                            <button className="btn-cancelar" onClick={() => setConfirmacion(null)}>Cancelar</button>
                            <button
                                className="btn-guardar"
                                onClick={async () => {
                                    const accion = confirmacion.accion;
                                    setConfirmacion(null);
                                    await accion();
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {formRonda && (
                <div className="modal" onClick={() => setFormRonda(null)}>
                    <section className="formularios" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <button className="cerrar-formulario" onClick={() => setFormRonda(null)}>X</button>
                        <div className="formularios-header">
                            <span className="formularios-eyebrow">Nueva ronda</span>
                            <h2>➕ Crear ronda</h2>
                            <p>El número de la ronda se asigna automáticamente. Los criterios se copian de la ronda anterior.</p>
                        </div>
                        <div className="formularios-body">
                            <div className="campo-formulario">
                                <input
                                    type="text"
                                    placeholder="Nombre de la ronda (p. ej. Ronda 2 · Auditorio)"
                                    value={formRonda.nombre}
                                    onChange={(e) => setFormRonda(prev => ({ ...prev, nombre: e.target.value }))}
                                />
                            </div>
                            <div className="campo-formulario">
                                <input
                                    type="number" min="0"
                                    placeholder="Cupos para la siguiente ronda"
                                    value={formRonda.cupos}
                                    onChange={(e) => setFormRonda(prev => ({ ...prev, cupos: e.target.value }))}
                                />
                            </div>
                            <div className="campo-formulario">
                                <input
                                    type="number" min="1" max="20"
                                    placeholder="Número de premios"
                                    value={formRonda.premios}
                                    onChange={(e) => setFormRonda(prev => ({ ...prev, premios: e.target.value }))}
                                />
                            </div>
                            <button
                                className="boton-primario"
                                onClick={() => crearRonda(formRonda)}
                            >
                                Crear ronda
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default GestionRondas;
