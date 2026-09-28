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

    const cargar = async () => {
        try {
            const leidas = JSON.parse(localStorage.getItem(storageKey) || '[]');
            let lista = [];

            if (tipo === 'super_admin' || rolId === 4 || tipo === 'admin' || rolId === 3) {
                // Pendientes por aceptar
                try {
                    const r = await fetch(`${SERVER_URL}/api/TablaSolicitudes.php`);
                    const d = await r.json();
                    const pendientes = d.data || [];
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
                } catch {}
                // Posters sin espacio
                try {
                    const r = await fetch(`${SERVER_URL}/api/TablaPosters.php`);
                    const d = await r.json();
                    const sinEspacio = (d.data || []).filter(p => !p.nombre_espacio);
                    if (sinEspacio.length > 0) {
                        lista.push({
                            id: 'sin-espacio',
                            icon: '📍',
                            titulo: `${sinEspacio.length} pósters sin ubicación`,
                            desc: 'Asigna espacio físico',
                            ancla: 'espacios'
                        });
                    }
                    // Sin evaluador (para super_admin)
                    if ((tipo === 'super_admin' || rolId === 4) && (d.data || []).length > 0) {
                        // conteo simple: si no sabemos, mostramos si hay posters sin evaluaciones
                        // se infiere revisando asignaciones en el modal, aquí solo placeholder si hay posters activos sin espacio ya cubierto
                    }
                } catch {}
            }

            if (tipo === 'usuario' || rolId === 1) {
                if (idUsuario) {
                    try {
                        const r = await fetch(`${SERVER_URL}/api/TablaPosters.php?id_usuario=${idUsuario}`);
                        const d = await r.json();
                        const misPosters = d.data || [];
                        for (const p of misPosters) {
                            try {
                                const er = await fetch(`${SERVER_URL}/api/Evaluaciones.php?id_poster=${p.id}`);
                                const ed = await er.json();
                                const tieneEval = ed.evaluaciones && Object.keys(ed.evaluaciones).length > 0;
                                if (tieneEval) {
                                    lista.push({
                                        id: `eval-${p.id}`,
                                        icon: '⭐',
                                        titulo: `Tu póster "${p.titulo.slice(0, 28)}" fue evaluado`,
                                        desc: 'Ver calificación',
                                        ancla: 'posters'
                                    });
                                }
                                if (!p.nombre_espacio) {
                                    // ya cubierto arriba, pero para usuario también
                                } else {
                                    // Si tiene espacio, notificar asignación (solo una vez)
                                    // Para simplificar, si tiene espacio y no está leído, mostrar
                                    // Evitamos duplicar: solo si no hay evaluación aún, mostrar asignación
                                    const key = `espacio-${p.id}-${p.nombre_espacio}`;
                                    if (!leidas.includes(key)) {
                                        lista.push({
                                            id: key,
                                            icon: '📍',
                                            titulo: `Póster "${p.titulo.slice(0, 22)}" asignado a ${p.nombre_espacio}`,
                                            desc: `Puesto ${p.ubicacion_detallada || ''}`,
                                            ancla: 'posters'
                                        });
                                    }
                                }
                            } catch {}
                        }
                        if (misPosters.length === 0) {
                            lista.push({ id: 'sin-posters', icon: '📤', titulo: 'Aún no has publicado pósters', desc: 'Carga tu primer póster', ancla: 'inicio' });
                        }
                    } catch {}
                }
            }

            if (tipo === 'evaluador' || rolId === 2) {
                if (idUsuario) {
                    try {
                        const r = await fetch(`${SERVER_URL}/api/TablaPosters.php?id_evaluador=${idUsuario}`);
                        const d = await r.json();
                        const asignados = d.data || [];
                        let pendientes = 0;
                        for (const p of asignados) {
                            try {
                                const er = await fetch(`${SERVER_URL}/api/Evaluaciones.php?id_poster=${p.id}&id_evaluador=${idUsuario}`);
                                const ed = await er.json();
                                const tiene = ed.evaluaciones && Object.keys(ed.evaluaciones).length > 0;
                                if (!tiene) pendientes++;
                            } catch {}
                        }
                        if (asignados.length > 0) {
                            lista.push({ id: 'asignados', icon: '📋', titulo: `${asignados.length} pósters asignados`, desc: pendienteTexto(pendientes), ancla: 'posters' });
                            if (pendientes > 0) {
                                lista.push({ id: 'pendientes-eval', icon: '✏️', titulo: `${pendientes} pendientes por calificar`, desc: 'Abre la tabla para calificar', ancla: 'posters' });
                            }
                        } else {
                            lista.push({ id: 'sin-asignados', icon: '📭', titulo: 'Sin pósters asignados', desc: 'Esperando asignación de admin', ancla: 'posters' });
                        }
                    } catch {}
                }
            }

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
        const id = setInterval(cargar, 60000);
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
                                <button key={n.id} className="notif-item" onClick={() => ir(n.ancla)}>
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
