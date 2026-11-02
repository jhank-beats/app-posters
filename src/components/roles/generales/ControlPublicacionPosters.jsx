import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../../config.js';
import './roles.css';

const formatearParaInputDateTime = (fechaSql) => {
    if (!fechaSql) return '';
    // Convierte 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM'
    return String(fechaSql).trim().replace(' ', 'T').slice(0, 16);
};

const ControlPublicacionPosters = ({ esSuperAdmin = false, onCambioEstado }) => {
    const [loading, setLoading] = useState(true);
    const [guardandoKey, setGuardandoKey] = useState(null);
    const [tarjetas, setTarjetas] = useState([]);
    const [formularios, setFormularios] = useState({});
    const [avisoGlobal, setAvisoGlobal] = useState(null);

    const cargarConfiguracion = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/Eventos.php?activo=1`);
            const json = await res.json();
            if (json.status === 'success' || json.success) {
                const porCarrera = json.por_carrera || {};
                const eventoPrincipal = json.data || null;

                let lista = [];
                if (esSuperAdmin) {
                    if (porCarrera.sistemas) {
                        lista.push({
                            key: 'sistemas',
                            carrera: 'sistemas',
                            tituloCarrera: '💻 Ingeniería de Sistemas',
                            colorBorde: '#00acc9',
                            evento: porCarrera.sistemas,
                        });
                    }
                    if (porCarrera.civil) {
                        lista.push({
                            key: 'civil',
                            carrera: 'civil',
                            tituloCarrera: '🏗️ Ingeniería Civil',
                            colorBorde: '#80ba27',
                            evento: porCarrera.civil,
                        });
                    }
                    if (lista.length === 0 && Array.isArray(json.eventos_activos)) {
                        lista = json.eventos_activos.map((ev) => ({
                            key: `${ev.carrera || 'sistemas'}_${ev.id_evento}`,
                            carrera: ev.carrera || 'sistemas',
                            tituloCarrera: ev.carrera === 'civil' ? '🏗️ Ingeniería Civil' : '💻 Ingeniería de Sistemas',
                            colorBorde: ev.carrera === 'civil' ? '#80ba27' : '#00acc9',
                            evento: ev,
                        }));
                    }
                } else if (eventoPrincipal) {
                    const esCivil = (eventoPrincipal.carrera || '').toLowerCase().includes('civil');
                    lista.push({
                        key: esCivil ? 'civil' : 'sistemas',
                        carrera: esCivil ? 'civil' : 'sistemas',
                        tituloCarrera: esCivil ? '🏗️ Ingeniería Civil' : '💻 Ingeniería de Sistemas',
                        colorBorde: esCivil ? '#80ba27' : '#00acc9',
                        evento: eventoPrincipal,
                    });
                }

                setTarjetas(lista);

                const nuevosForms = {};
                lista.forEach((item) => {
                    const ev = item.evento || {};
                    nuevosForms[item.key] = {
                        id_evento: ev.id_evento,
                        carrera: item.carrera,
                        publicacion_habilitada: ev.publicacion_habilitada !== undefined ? Number(ev.publicacion_habilitada) === 1 : true,
                        usar_horario_publicacion: ev.usar_horario_publicacion !== undefined ? Number(ev.usar_horario_publicacion) === 1 : false,
                        publicacion_inicio: formatearParaInputDateTime(ev.publicacion_inicio),
                        publicacion_fin: formatearParaInputDateTime(ev.publicacion_fin),
                    };
                });
                setFormularios(nuevosForms);
            }
        } catch (err) {
            console.error('Error al cargar configuración de publicación de pósters:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarConfiguracion();
    }, [esSuperAdmin]);

    const actualizarCampo = (key, campo, valor) => {
        setFormularios((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                [campo]: valor,
            },
        }));
    };

    const enviarConfiguracion = async (key, overrides = {}, mensajeExito = null) => {
        setAvisoGlobal(null);
        const formActual = { ...(formularios[key] || {}), ...overrides };
        if (formActual.usar_horario_publicacion) {
            if (!formActual.publicacion_inicio || !formActual.publicacion_fin) {
                setAvisoGlobal({
                    tipo: 'error',
                    texto: '⚠️ Debes indicar tanto la fecha/hora de inicio como la fecha/hora final para activar el horario de publicación.',
                });
                return;
            }
            const tsIni = new Date(formActual.publicacion_inicio).getTime();
            const tsFin = new Date(formActual.publicacion_fin).getTime();
            if (isNaN(tsIni) || isNaN(tsFin) || tsFin <= tsIni) {
                setAvisoGlobal({
                    tipo: 'error',
                    texto: '⚠️ La fecha y hora de cierre debe ser posterior a la fecha y hora de inicio.',
                });
                return;
            }
        }

        try {
            setGuardandoKey(key);
            const res = await fetch(`${API_BASE}/Eventos.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'configurar_publicacion',
                    id_evento: formActual.id_evento,
                    carrera: formActual.carrera,
                    publicacion_habilitada: formActual.publicacion_habilitada ? 1 : 0,
                    usar_horario_publicacion: formActual.usar_horario_publicacion ? 1 : 0,
                    publicacion_inicio: formActual.publicacion_inicio || null,
                    publicacion_fin: formActual.publicacion_fin || null,
                }),
            });
            const data = await res.json();
            if (res.ok && (data.status === 'success' || data.success)) {
                setAvisoGlobal({
                    tipo: 'exito',
                    texto: '✅ ' + (mensajeExito || data.message || 'Se actualizó el estado de publicación de pósters.'),
                });
                await cargarConfiguracion();
                if (typeof onCambioEstado === 'function') {
                    onCambioEstado(data);
                }
            } else {
                setAvisoGlobal({
                    tipo: 'error',
                    texto: '❌ ' + (data.message || 'Error al actualizar la configuración de publicación.'),
                });
            }
        } catch (error) {
            console.error('Error al guardar configuración de publicación:', error);
            setAvisoGlobal({
                tipo: 'error',
                texto: '❌ No se pudo conectar con el servidor.',
            });
        } finally {
            setGuardandoKey(null);
        }
    };

    if (loading) {
        return (
            <div className="tarjeta" style={{ marginBottom: '1.5rem', padding: '1.25rem', textAlign: 'center' }}>
                Cargando configuración de publicación de pósters...
            </div>
        );
    }

    if (tarjetas.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                marginBottom: '1.75rem',
                background: '#f8fafc',
                border: '1px solid rgba(19, 39, 64, 0.1)',
                borderRadius: '16px',
                padding: '1.25rem',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                    <h3 style={{ margin: 0, color: '#132740', fontSize: '1.1rem' }}>
                        🔒 Control y Horario de Publicación de Pósters
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', color: '#5f5e5e', fontSize: '0.88rem' }}>
                        {esSuperAdmin
                            ? 'Habilita o cierra la subida de pósters y configura horarios de apertura/cierre de forma independiente para cada carrera. Cuando está cerrado, ni usuarios ni evaluadores pueden subir pósters.'
                            : 'Habilita o cierra la subida de pósters y configura el horario permitido para tu carrera. Cuando está cerrado, ni usuarios ni evaluadores pueden subir pósters.'}
                    </p>
                </div>
            </div>

            {avisoGlobal && (
                <div
                    role="status"
                    style={{
                        marginBottom: '1rem',
                        padding: '0.7rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        background: avisoGlobal.tipo === 'exito' ? 'rgba(46, 125, 50, 0.12)' : 'rgba(198, 40, 40, 0.12)',
                        color: avisoGlobal.tipo === 'exito' ? '#1b5e20' : '#b71c1c',
                        border: `1px solid ${avisoGlobal.tipo === 'exito' ? 'rgba(46, 125, 50, 0.3)' : 'rgba(198, 40, 40, 0.3)'}`,
                    }}
                >
                    {avisoGlobal.texto}
                </div>
            )}

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: esSuperAdmin && tarjetas.length > 1 ? 'repeat(auto-fit, minmax(340px, 1fr))' : '1fr',
                    gap: '1.25rem',
                }}
            >
                {tarjetas.map((item) => {
                    const ev = item.evento || {};
                    const estadoPub = ev.estado_publicacion || {};
                    const abierta = Boolean(estadoPub.abierta);
                    const form = formularios[item.key] || {};
                    const estaGuardando = guardandoKey === item.key;

                    return (
                        <div
                            key={item.key}
                            style={{
                                background: '#ffffff',
                                borderRadius: '14px',
                                border: '1px solid rgba(19, 39, 64, 0.1)',
                                borderTop: `4px solid ${item.colorBorde}`,
                                padding: '1.25rem',
                                boxShadow: '0 4px 14px rgba(19, 39, 64, 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                            }}
                        >
                            {/* Encabezado de carrera y estado actual */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div>
                                    <h4 style={{ margin: 0, color: '#132740', fontSize: '1.02rem' }}>{item.tituloCarrera}</h4>
                                    <span style={{ fontSize: '0.82rem', color: '#5f5e5e' }}>
                                        Evento: <strong>{ev.nombre_evento}</strong> {ev.codigo_evento ? `(${ev.codigo_evento})` : ''}
                                    </span>
                                </div>
                                <span
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: '999px',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        background: abierta ? 'rgba(46, 125, 50, 0.12)' : 'rgba(198, 40, 40, 0.12)',
                                        color: abierta ? '#2e7d32' : '#c62828',
                                        border: `1px solid ${abierta ? 'rgba(46, 125, 50, 0.3)' : 'rgba(198, 40, 40, 0.3)'}`,
                                    }}
                                >
                                    {abierta ? '🟢 PUBLICACIÓN ABIERTA' : '🔴 PUBLICACIÓN CERRADA'}
                                </span>
                            </div>

                            {/* Mensaje explicativo del estado actual */}
                            <div
                                style={{
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '10px',
                                    background: abierta ? 'rgba(0, 172, 201, 0.08)' : 'rgba(198, 40, 40, 0.06)',
                                    color: '#132740',
                                    fontSize: '0.84rem',
                                    lineHeight: 1.4,
                                }}
                            >
                                {estadoPub.mensaje || (abierta ? 'La publicación está habilitada.' : 'La publicación se encuentra cerrada.')}
                            </div>

                            {/* Botones de Habilitar / Deshabilitar publicación general */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#132740', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    1. Estado General de Publicación
                                </span>
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        disabled={estaGuardando || form.publicacion_habilitada}
                                        onClick={() =>
                                            enviarConfiguracion(
                                                item.key,
                                                { publicacion_habilitada: true },
                                                `Publicación de pósters habilitada para ${item.tituloCarrera}.`
                                            )
                                        }
                                        style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            padding: '0.55rem 0.9rem',
                                            borderRadius: '9px',
                                            border: form.publicacion_habilitada ? '2px solid #2e7d32' : '1px solid #cbd5e1',
                                            background: form.publicacion_habilitada ? '#2e7d32' : '#f8fafc',
                                            color: form.publicacion_habilitada ? '#ffffff' : '#132740',
                                            fontWeight: 700,
                                            fontSize: '0.84rem',
                                            cursor: estaGuardando || form.publicacion_habilitada ? 'default' : 'pointer',
                                            opacity: estaGuardando ? 0.65 : 1,
                                        }}
                                    >
                                        🔓 Habilitar Publicación
                                    </button>
                                    <button
                                        type="button"
                                        disabled={estaGuardando || !form.publicacion_habilitada}
                                        onClick={() =>
                                            enviarConfiguracion(
                                                item.key,
                                                { publicacion_habilitada: false },
                                                `Publicación de pósters cerrada para ${item.tituloCarrera}.`
                                            )
                                        }
                                        style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            padding: '0.55rem 0.9rem',
                                            borderRadius: '9px',
                                            border: !form.publicacion_habilitada ? '2px solid #c62828' : '1px solid #cbd5e1',
                                            background: !form.publicacion_habilitada ? '#c62828' : '#f8fafc',
                                            color: !form.publicacion_habilitada ? '#ffffff' : '#132740',
                                            fontWeight: 700,
                                            fontSize: '0.84rem',
                                            cursor: estaGuardando || !form.publicacion_habilitada ? 'default' : 'pointer',
                                            opacity: estaGuardando ? 0.65 : 1,
                                        }}
                                    >
                                        🔒 Cerrar Publicación
                                    </button>
                                </div>
                            </div>

                            {/* Programación de Horario (Inicio y Fin) */}
                            <div
                                style={{
                                    borderTop: '1px solid rgba(19, 39, 64, 0.08)',
                                    paddingTop: '0.85rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.65rem',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#132740', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        2. Horario Programado de Publicación
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            padding: '2px 9px',
                                            borderRadius: '999px',
                                            background: form.usar_horario_publicacion ? 'rgba(0, 172, 201, 0.15)' : '#e2e8f0',
                                            color: form.usar_horario_publicacion ? '#005f73' : '#475569',
                                        }}
                                    >
                                        {form.usar_horario_publicacion ? '⏰ Horario Activo' : '⏸️ Horario Inactivo'}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                            Inicio de publicación:
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={form.publicacion_inicio || ''}
                                            onChange={(e) => actualizarCampo(item.key, 'publicacion_inicio', e.target.value)}
                                            style={{
                                                padding: '0.45rem 0.6rem',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.84rem',
                                                color: '#132740',
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                            Fin de publicación:
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={form.publicacion_fin || ''}
                                            onChange={(e) => actualizarCampo(item.key, 'publicacion_fin', e.target.value)}
                                            style={{
                                                padding: '0.45rem 0.6rem',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.84rem',
                                                color: '#132740',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                    <button
                                        type="button"
                                        disabled={estaGuardando}
                                        onClick={() =>
                                            enviarConfiguracion(
                                                item.key,
                                                { usar_horario_publicacion: true },
                                                `Horario de publicación activado y guardado para ${item.tituloCarrera}.`
                                            )
                                        }
                                        style={{
                                            flex: 1,
                                            minWidth: '140px',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: '#00acc9',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            cursor: estaGuardando ? 'default' : 'pointer',
                                        }}
                                    >
                                        ⏰ {form.usar_horario_publicacion ? 'Guardar Horario' : 'Activar y Guardar Horario'}
                                    </button>
                                    {form.usar_horario_publicacion && (
                                        <button
                                            type="button"
                                            disabled={estaGuardando}
                                            onClick={() =>
                                                enviarConfiguracion(
                                                    item.key,
                                                    { usar_horario_publicacion: false },
                                                    `Restricción de horario desactivada para ${item.tituloCarrera}.`
                                                )
                                            }
                                            style={{
                                                padding: '0.5rem 0.85rem',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                background: '#f1f5f9',
                                                color: '#334155',
                                                fontWeight: 600,
                                                fontSize: '0.82rem',
                                                cursor: estaGuardando ? 'default' : 'pointer',
                                            }}
                                        >
                                            ⏸️ Desactivar Horario
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ControlPublicacionPosters;
