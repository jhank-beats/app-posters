import React, { useState, useEffect, useRef } from 'react';
import { FaBell } from 'react-icons/fa';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const NotificacionesBell = ({ tipo }) => {
    const [notifs, setNotifs] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const [noLeidas, setNoLeidas] = useState(0);
    const ref = useRef(null);

    const rolId = parseInt(localStorage.getItem('id_rol') || localStorage.getItem('rol') || '0', 10);
    const idUsuario = localStorage.getItem('idUsuario') || localStorage.getItem('id_usuario') || '';

    const storageKey = `notif_leidas_${tipo || rolId}_${idUsuario}`;

    const marcarLeidas = () => {
        const ids = notifs.map(n => n.id);
        localStorage.setItem(storageKey, JSON.stringify(ids));
        setNoLeidas(0);
    };

    // Respuesta JSON sin romper la cadena si un endpoint falla.
    const pedir = (url) => fetch(url).then(r => r.json()).catch(() => null);

    const cargar = async () => {
        try {
            const leidas = JSON.parse(localStorage.getItem(storageKey) || '[]');
            let lista = [];

            const esAdmin = tipo === 'super_admin' || rolId === 4 || tipo === 'admin' || rolId === 3;
            const esUsuario = tipo === 'usuario' || rolId === 1;
            const esEvaluador = tipo === 'evaluador' || rolId === 2;
            const conPosters = (esUsuario || esEvaluador) && !!idUsuario;

            // 1. Fuentes independientes: UNA tanda de peticiones en paralelo.
            const [dNotifs, dSolicitudes, dPosters] = await Promise.all([
                pedir(`${SERVER_URL}/api/Notificaciones.php`),
                esAdmin ? pedir(`${SERVER_URL}/api/TablaSolicitudes.php`) : Promise.resolve(null),
                esAdmin
                    ? pedir(`${SERVER_URL}/api/TablaPosters.php`)
                    : (conPosters
                        ? pedir(`${SERVER_URL}/api/TablaPosters.php?${esUsuario ? 'id_usuario' : 'id_evaluador'}=${idUsuario}`)
                        : Promise.resolve(null)),
            ]);

            const misPosters = (dPosters && dPosters.data) || [];

            // 2. Evaluaciones de TODOS los pósters en UNA sola petición
            //    (antes: 1 petición por póster, en serie).
            let dEvals = null;
            if (conPosters && misPosters.length > 0) {
                const ids = misPosters.map(p => p.id);
                const extra = esEvaluador ? `&id_evaluador=${idUsuario}` : '';
                dEvals = await pedir(`${SERVER_URL}/api/Evaluaciones.php?ids=${ids.join(',')}${extra}`);
            }
            const resultados = (dEvals && dEvals.resultados) || {};
            const tieneEvaluaciones = (id) => {
                const r = resultados[id];
                return !!(r && r.evaluaciones && Object.keys(r.evaluaciones).length > 0);
            };

            if (esAdmin) {
                // Pendientes por aceptar
                const pendientes = (dSolicitudes && dSolicitudes.data) || [];
                if (pendientes.length > 0) {
                    lista.push({
                        id: 'pendientes',
                        icon: '👥',
                        titulo: `${pendientes.length} solicitudes pendientes`,
                        desc: 'Usuarios esperando aprobación',
                        ancla: 'pendientes',
                        count: pendientes.length
                    });
                }
                // Pósters sin ubicación
                const sinEspacio = misPosters.filter(p => !p.nombre_espacio);
                if (sinEspacio.length > 0) {
                    lista.push({
                        id: 'sin-espacio',
                        icon: '📍',
                        titulo: `${sinEspacio.length} pósters sin ubicación`,
                        desc: 'Asigna espacio físico',
                        ancla: 'espacios'
                    });
                }
            }

            if (esUsuario && idUsuario) {
                for (const p of misPosters) {
                    if (tieneEvaluaciones(p.id)) {
                        lista.push({
                            id: `eval-${p.id}`,
                            icon: '⭐',
                            titulo: `Tu póster "${p.titulo.slice(0, 28)}" fue evaluado`,
                            desc: 'Ver calificación',
                            ancla: 'posters'
                        });
                    } else if (p.nombre_espacio) {
                        // Asignación de espacio: una sola vez, si aún no está leída.
                        const key = `espacio-${p.id}-${p.nombre_espacio}`;
                        if (!leidas.includes(key)) {
                            const etiquetaEsp = `${p.nombre_espacio}${p.ubicacion_detallada ? ` #${p.ubicacion_detallada}` : ''}`;
                            lista.push({
                                id: key,
                                icon: '📍',
                                titulo: `Póster "${p.titulo.slice(0, 22)}" asignado a ${etiquetaEsp}`,
                                desc: `Ubicación: ${etiquetaEsp}`,
                                ancla: 'posters'
                            });
                        }
                    }
                }
                if (misPosters.length === 0) {
                    lista.push({ id: 'sin-posters', icon: '📤', titulo: 'Aún no has publicado pósters', desc: 'Carga tu primer póster', ancla: 'inicio' });
                }
            }

            const notifsServidor = (dNotifs && dNotifs.data) || [];
            const servidorTraePendientes = notifsServidor.some(n => String(n.id || '').startsWith('pendientes-'));

            if (esEvaluador && idUsuario) {
                const postersPendientes = misPosters.filter(p => !tieneEvaluaciones(p.id));
                const pendientes = postersPendientes.length;
                if (misPosters.length > 0) {
                    lista.push({ id: 'asignados', icon: '📋', titulo: `${misPosters.length} pósters asignados`, desc: pendienteTexto(pendientes), ancla: 'posters' });
                    if (pendientes > 0 && !servidorTraePendientes) {
                        const resumenTitulosEspacios = postersPendientes.map(p => {
                            const ubi = p.nombre_espacio
                                ? `${p.nombre_espacio}${p.ubicacion_detallada ? ` #${p.ubicacion_detallada}` : ''}`
                                : 'Sin ubicar todavía';
                            return `"${p.titulo}" (📍 ${ubi})`;
                        }).join(' · ');
                        lista.push({
                            id: `pendientes-eval-${pendientes}`,
                            icon: '✏️',
                            titulo: `Tienes ${pendientes} ${pendientes === 1 ? 'póster pendiente' : 'pósters pendientes'} por calificar`,
                            desc: `Faltan: ${resumenTitulosEspacios}`,
                            ancla: 'posters'
                        });
                    }
                } else {
                    lista.push({ id: 'sin-asignados', icon: '📭', titulo: 'Sin pósters asignados', desc: 'Esperando asignación de admin', ancla: 'posters' });
                }
            }

            // Novedades de rondas, premios, recordatorios y cambios de espacio (según el rol del token)
            notifsServidor.forEach(n => lista.push(n));

            if (lista.length === 0) {
                lista.push({ id: 'vacio', icon: '✅', titulo: 'Sin notificaciones', desc: 'Todo al día', ancla: null });
            }

            const noLeidasCount = lista.filter(n => n.id !== 'vacio' && !leidas.includes(n.id)).length;
            setNotifs(lista);
            setNoLeidas(noLeidasCount);
        } catch (e) {
            console.error('notif error', e);
        }
    };

    function pendienteTexto(n) {
        if (n === 0) return 'Todo calificado';
        if (n === 1) return '1 por calificar';
        return `${n} por calificar`;
    }

    useEffect(() => {
        cargar();
        // Cada 5 min basta para notificaciones (antes: cada 60 s saturaba el servidor).
        const id = setInterval(cargar, 300000);
        const onClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => { clearInterval(id); document.removeEventListener('mousedown', onClickOutside); };
    }, [tipo, idUsuario, rolId]);

    const ir = (ancla) => {
        setAbierto(false);
        marcarLeidas();
        if (!ancla) return;
        const el = document.getElementById(ancla);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="notif-wrapper" ref={ref}>
            <button className="notif-bell notif-bell--blanco" onClick={() => { setAbierto(!abierto); if (!abierto) cargar(); }} aria-label="Notificaciones" style={{ width: '44px', height: '44px' }}>
                <FaBell style={{ color: '#ffffff', fontSize: '26px', width: '26px', height: '26px', display: 'block', flexShrink: 0 }} />
                {noLeidas > 0 && <span className="notif-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
            </button>
            {abierto && (
                <div className="modal-notif" onClick={() => setAbierto(false)}>
                    <div className="notif-modal" onClick={e => e.stopPropagation()}>
                        <button className="cerrar-formulario" onClick={() => setAbierto(false)} aria-label="Cerrar">X</button>
                        <div className="formularios-header" style={{ paddingTop: 0, marginBottom: '1rem' }}>
                            <span className="formularios-eyebrow">Centro de notificaciones</span>
                            <h2>🔔 Notificaciones</h2>
                            <p>{noLeidas > 0 ? `Tienes ${noLeidas} pendientes` : 'Todo al día'}</p>
                        </div>
                        {noLeidas > 0 && (
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <button className="notif-marcar" onClick={marcarLeidas}>Marcar todas como leídas</button>
                            </div>
                        )}
                        <div className="notif-lista notif-lista--modal">
                            {notifs.map(n => (
                                <button
                                    key={n.id}
                                    className={`notif-item${n.tipo === 'cambio-espacio' ? ' notif-item--cambio-espacio' : ''}`}
                                    onClick={() => ir(n.ancla)}
                                >
                                    <span className="notif-icon">{n.icon}</span>
                                    <span className="notif-text">
                                        <span className="notif-titulo">{n.titulo}</span>
                                        <span className="notif-desc">{n.desc}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificacionesBell;
