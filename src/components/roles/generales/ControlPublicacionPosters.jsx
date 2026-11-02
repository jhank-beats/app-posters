import React, { useState, useEffect } from 'react';
import { FaClock, FaLock, FaLockOpen, FaCalendarAlt } from 'react-icons/fa';
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';
import './roles.css';

const formatearParaInputDateTime = (fechaSql) => {
    if (!fechaSql) return '';
    return String(fechaSql).trim().replace(' ', 'T').slice(0, 16);
};

const ControlPublicacionPosters = ({ esSuperAdmin = false, onCambioEstado }) => {
    const [loading, setLoading] = useState(true);
    const [guardandoKey, setGuardandoKey] = useState(null);
    const [tarjetas, setTarjetas] = useState([]);
    const [modalHorarioItem, setModalHorarioItem] = useState(null);
    const [formHorario, setFormHorario] = useState({ inicio: '', fin: '', usar: false });
    const [aviso, setAviso] = useState(null);

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
                            evento: porCarrera.sistemas,
                        });
                    }
                    if (porCarrera.civil) {
                        lista.push({
                            key: 'civil',
                            carrera: 'civil',
                            tituloCarrera: '🏗️ Ingeniería Civil',
                            evento: porCarrera.civil,
                        });
                    }
                    if (lista.length === 0 && Array.isArray(json.eventos_activos)) {
                        lista = json.eventos_activos.map((ev) => ({
                            key: `${ev.carrera || 'sistemas'}_${ev.id_evento}`,
                            carrera: ev.carrera || 'sistemas',
                            tituloCarrera: ev.carrera === 'civil' ? '🏗️ Ingeniería Civil' : '💻 Ingeniería de Sistemas',
                            evento: ev,
                        }));
                    }
                } else if (eventoPrincipal) {
                    const esCivil = (eventoPrincipal.carrera || '').toLowerCase().includes('civil');
                    lista.push({
                        key: esCivil ? 'civil' : 'sistemas',
                        carrera: esCivil ? 'civil' : 'sistemas',
                        tituloCarrera: esCivil ? '🏗️ Ingeniería Civil' : '💻 Ingeniería de Sistemas',
                        evento: eventoPrincipal,
                    });
                }

                setTarjetas(lista);
            }
        } catch (err) {
            console.error('Error al cargar configuración de publicación:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarConfiguracion();
    }, [esSuperAdmin]);

    const mostrarAvisoTemporal = (tipo, texto) => {
        setAviso({ tipo, texto });
        setTimeout(() => {
            setAviso((prev) => (prev && prev.texto === texto ? null : prev));
        }, 5000);
    };

    const alternarPublicacionRapida = async (item) => {
        const ev = item.evento || {};
        const nuevoEstado = Number(ev.publicacion_habilitada) === 1 ? 0 : 1;
        const accionTexto = nuevoEstado === 1 ? 'habilitar' : 'cerrar';

        const confirmar = window.confirm(
            `¿Estás seguro de que deseas ${accionTexto} la publicación de pósters para ${item.tituloCarrera}?`
        );
        if (!confirmar) return;

        try {
            setGuardandoKey(item.key);
            const res = await fetch(`${API_BASE}/Eventos.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'configurar_publicacion',
                    id_evento: ev.id_evento,
                    carrera: item.carrera,
                    publicacion_habilitada: nuevoEstado,
                }),
            });
            const data = await res.json();
            if (res.ok && (data.status === 'success' || data.success)) {
                mostrarAvisoTemporal('exito', data.message || `Publicación ${nuevoEstado === 1 ? 'habilitada' : 'cerrada'} para ${item.tituloCarrera}.`);
                await cargarConfiguracion();
                if (typeof onCambioEstado === 'function') onCambioEstado(data);
            } else {
                mostrarAvisoTemporal('error', data.message || 'No se pudo actualizar el estado de publicación.');
            }
        } catch (error) {
            console.error('Error al alternar publicación:', error);
            mostrarAvisoTemporal('error', 'Error al conectar con el servidor.');
        } finally {
            setGuardandoKey(null);
        }
    };

    const abrirModalHorario = (item) => {
        const ev = item.evento || {};
        setModalHorarioItem(item);
        setFormHorario({
            inicio: formatearParaInputDateTime(ev.publicacion_inicio),
            fin: formatearParaInputDateTime(ev.publicacion_fin),
            usar: Number(ev.usar_horario_publicacion) === 1,
        });
    };

    const cerrarModalHorario = () => {
        setModalHorarioItem(null);
    };

    const guardarHorario = async (desactivar = false) => {
        if (!modalHorarioItem) return;
        const item = modalHorarioItem;
        const ev = item.evento || {};

        const usarHorario = desactivar ? 0 : 1;

        if (usarHorario === 1) {
            if (!formHorario.inicio || !formHorario.fin) {
                alert('⚠️ Debes indicar tanto la fecha/hora de inicio como la fecha/hora final para activar el horario.');
                return;
            }
            const tsIni = new Date(formHorario.inicio).getTime();
            const tsFin = new Date(formHorario.fin).getTime();
            if (isNaN(tsIni) || isNaN(tsFin) || tsFin <= tsIni) {
                alert('⚠️ La fecha y hora de cierre debe ser posterior a la fecha y hora de inicio.');
                return;
            }
        }

        try {
            setGuardandoKey(item.key);
            const res = await fetch(`${API_BASE}/Eventos.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion: 'configurar_publicacion',
                    id_evento: ev.id_evento,
                    carrera: item.carrera,
                    usar_horario_publicacion: usarHorario,
                    publicacion_inicio: formHorario.inicio || null,
                    publicacion_fin: formHorario.fin || null,
                }),
            });
            const data = await res.json();
            if (res.ok && (data.status === 'success' || data.success)) {
                mostrarAvisoTemporal('exito', data.message || `Horario actualizado para ${item.tituloCarrera}.`);
                cerrarModalHorario();
                await cargarConfiguracion();
                if (typeof onCambioEstado === 'function') onCambioEstado(data);
            } else {
                alert('❌ ' + (data.message || 'Error al guardar el horario.'));
            }
        } catch (error) {
            console.error('Error al guardar horario:', error);
            alert('❌ No se pudo conectar con el servidor.');
        } finally {
            setGuardandoKey(null);
        }
    };

    return (
        <>
            <div className="contenedor-tabla">
                <HintScrollTabla />

                {aviso && (
                    <div
                        role="status"
                        style={{
                            margin: '0.75rem 0',
                            padding: '0.65rem 1rem',
                            borderRadius: '10px',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            background: aviso.tipo === 'exito' ? 'rgba(46, 125, 50, 0.12)' : 'rgba(198, 40, 40, 0.12)',
                            color: aviso.tipo === 'exito' ? '#1b5e20' : '#b71c1c',
                            border: `1px solid ${aviso.tipo === 'exito' ? 'rgba(46, 125, 50, 0.3)' : 'rgba(198, 40, 40, 0.3)'}`,
                        }}
                    >
                        {aviso.texto}
                    </div>
                )}

                <table>
                    <thead>
                        <tr>
                            <th>Carrera / Convocatoria</th>
                            <th>Estado de Recepción</th>
                            <th>Restricción de Horario</th>
                            <th>Detalle en Tiempo Real</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    Cargando estado de publicación de pósters...
                                </td>
                            </tr>
                        ) : tarjetas.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    No se encontraron eventos activos configurados.
                                </td>
                            </tr>
                        ) : (
                            tarjetas.map((item) => {
                                const ev = item.evento || {};
                                const estadoPub = ev.estado_publicacion || {};
                                const abierta = Boolean(estadoPub.abierta);
                                const tieneHorario = Number(ev.usar_horario_publicacion) === 1;
                                const estaGuardando = guardandoKey === item.key;

                                return (
                                    <tr key={item.key}>
                                        <td>
                                            <strong>{item.tituloCarrera}</strong>
                                            <div className="subtexto-celda">
                                                {ev.nombre_evento || `Evento #${ev.id_evento}`}
                                            </div>
                                        </td>
                                        <td>
                                            {abierta ? (
                                                <span className="badge-rol rol-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ color: '#2e7d32' }}>●</span> ABIERTA
                                                </span>
                                            ) : (
                                                <span className="badge-rol" style={{ background: 'rgba(211,47,47,0.1)', color: '#c62828', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>●</span> CERRADA
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {tieneHorario ? (
                                                <div>
                                                    <span className="badge-hora-recordatorio" style={{ background: 'rgba(0,172,201,0.12)', color: '#005f73' }}>
                                                        ⏰ Horario Programado
                                                    </span>
                                                    <div className="subtexto-celda" style={{ marginTop: '3px' }}>
                                                        {estadoPub.publicacion_inicio_legible && estadoPub.publicacion_fin_legible ? (
                                                            <>Del {estadoPub.publicacion_inicio_legible} al {estadoPub.publicacion_fin_legible}</>
                                                        ) : (
                                                            <>Activo</>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="subtexto-celda">Sin restricción horaria</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ maxWidth: '320px', fontSize: '0.84rem', color: '#475569', lineHeight: 1.35 }}>
                                                {estadoPub.mensaje || (abierta ? 'Publicación habilitada.' : 'Publicación cerrada.')}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="acciones-celda-rec" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className={`btn-accion-tabla ${abierta ? 'btn-pausar-rec' : 'btn-asignar'}`}
                                                    disabled={estaGuardando}
                                                    onClick={() => alternarPublicacionRapida(item)}
                                                    title={abierta ? 'Cerrar publicación' : 'Habilitar publicación'}
                                                    style={{ whiteSpace: 'nowrap' }}
                                                >
                                                    {abierta ? (
                                                        <><FaLock /> Cerrar</>
                                                    ) : (
                                                        <><FaLockOpen /> Habilitar</>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-accion-tabla btn-ranking-tabla"
                                                    disabled={estaGuardando}
                                                    onClick={() => abrirModalHorario(item)}
                                                    title="Configurar horario programado de inicio y fin"
                                                    style={{ whiteSpace: 'nowrap' }}
                                                >
                                                    <FaClock /> Horario
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Institucional para Configurar Horario (Fuera de .contenedor-tabla) */}
            {modalHorarioItem && (
                <div className="modal" onClick={cerrarModalHorario}>
                    <div
                        className="modal-formulario"
                        style={{ maxWidth: '520px', width: '92%', position: 'relative' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="cerrar-tabla"
                            onClick={cerrarModalHorario}
                            aria-label="Cerrar modal"
                            style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}
                        >
                            ✕
                        </button>

                        <span className="seccion-eyebrow">Programación de Fechas</span>
                        <h2 style={{ fontSize: '1.25rem', margin: '0.25rem 0 0.5rem', color: '#132740' }}>
                            Horario de Publicación de Pósters
                        </h2>
                        <p style={{ color: '#5f5e5e', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                            {modalHorarioItem.tituloCarrera} — Evento: {modalHorarioItem.evento?.nombre_evento}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                            <div className="campo-formulario" style={{ margin: 0 }}>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#132740', marginBottom: '0.35rem' }}>
                                    <FaCalendarAlt style={{ color: '#00acc9', marginRight: '6px' }} />
                                    Fecha y hora de inicio:
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formHorario.inicio}
                                    onChange={(e) => setFormHorario({ ...formHorario, inicio: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            <div className="campo-formulario" style={{ margin: 0 }}>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#132740', marginBottom: '0.35rem' }}>
                                    <FaCalendarAlt style={{ color: '#80ba27', marginRight: '6px' }} />
                                    Fecha y hora final de cierre:
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formHorario.fin}
                                    onChange={(e) => setFormHorario({ ...formHorario, fin: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', fontSize: '0.82rem', color: '#5f5e5e', border: '1px solid #e2e8f0' }}>
                                ℹ️ Mientras el horario esté activo, la plataforma solo permitirá subir pósters dentro del rango de fecha y hora especificado. Fuera de ese rango, el formulario quedará bloqueado.
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="boton-primario"
                                    disabled={guardandoKey !== null}
                                    onClick={() => guardarHorario(false)}
                                    style={{
                                        flex: 1,
                                        minWidth: '170px',
                                        backgroundColor: '#00acc9',
                                        color: '#ffffff',
                                        border: '2px solid #00acc9',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        padding: '0.65rem 1.25rem',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(0, 172, 201, 0.25)',
                                    }}
                                >
                                    ⏰ Activar y Guardar Horario
                                </button>
                                {Number(modalHorarioItem.evento?.usar_horario_publicacion) === 1 && (
                                    <button
                                        type="button"
                                        className="boton-secundario"
                                        disabled={guardandoKey !== null}
                                        onClick={() => guardarHorario(true)}
                                        style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            backgroundColor: '#f8fafc',
                                            color: '#c62828',
                                            border: '1.5px solid #ef4444',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            padding: '0.65rem 1rem',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ⏸️ Desactivar Horario
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="boton-secundario"
                                    onClick={cerrarModalHorario}
                                    style={{
                                        padding: '0.65rem 1.15rem',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ControlPublicacionPosters;
