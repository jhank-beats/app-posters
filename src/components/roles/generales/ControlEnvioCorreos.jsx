import React, { useState, useEffect } from 'react';
import { FaEnvelope, FaBan, FaCheckCircle, FaGlobe, FaLaptopCode, FaHardHat } from 'react-icons/fa';
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';
import './roles.css';

const ControlEnvioCorreos = ({ esSuperAdmin = false }) => {
    const [loading, setLoading] = useState(true);
    const [guardandoClave, setGuardandoClave] = useState(null);
    const [datosConfig, setDatosConfig] = useState(null);
    const [aviso, setAviso] = useState(null);

    const cargarConfiguracion = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/CorreosConfig.php`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setDatosConfig(data);
            }
        } catch (err) {
            console.error('Error al cargar configuración de correos:', err);
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

    const alternarCorreos = async (tipo, item = null) => {
        const esGlobal = tipo === 'global';
        const estadoActual = esGlobal
            ? Boolean(datosConfig?.global_habilitado)
            : Boolean(item?.correos_habilitados);

        const nuevoEstado = !estadoActual;
        const accionTexto = nuevoEstado ? 'HABILITAR' : 'PAUSAR';
        const destinoTexto = esGlobal
            ? 'TODOS los correos del sistema'
            : `los correos de ${item?.carrera_etiqueta || item?.carrera}`;

        const confirmar = window.confirm(
            `¿Estás seguro de que deseas ${accionTexto} ${destinoTexto}?`
        );
        if (!confirmar) return;

        const claveOperacion = esGlobal ? 'global' : item?.carrera;

        try {
            setGuardandoClave(claveOperacion);
            const payload = esGlobal
                ? { accion: 'configurar_correos', ambito: 'global', habilitado: nuevoEstado ? 1 : 0 }
                : { accion: 'configurar_correos', ambito: 'carrera', carrera: item?.carrera, id_evento: item?.id_evento, habilitado: nuevoEstado ? 1 : 0 };

            const res = await fetch(`${API_BASE}/CorreosConfig.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (res.ok && (data.status === 'success' || data.success)) {
                mostrarAvisoTemporal('exito', data.message || `Correos ${nuevoEstado ? 'habilitados' : 'pausados'} exitosamente.`);
                await cargarConfiguracion();
            } else {
                mostrarAvisoTemporal('error', data.message || 'No se pudo actualizar la configuración de correos.');
            }
        } catch (error) {
            console.error('Error al actualizar correos:', error);
            mostrarAvisoTemporal('error', 'Error al conectar con el servidor.');
        } finally {
            setGuardandoClave(null);
        }
    };

    const globalHabilitado = datosConfig ? Boolean(datosConfig.global_habilitado) : true;
    const porCarrera = datosConfig?.por_carrera || {};
    const listaCarreras = Object.values(porCarrera);

    return (
        <div className="contenedor-tabla">
            <HintScrollTabla
                sugerencia="Desliza a la derecha para ver detalle y alternar el interruptor de correos"
            />

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

            {!globalHabilitado && (
                <div
                    style={{
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        background: 'rgba(211,47,47,0.1)',
                        color: '#c62828',
                        border: '1px solid rgba(211,47,47,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <FaBan />
                    <span>
                        Atención: El interruptor general de correos está <strong>PAUSADO</strong>. Ningún correo automático se enviará mientras permanezca en este estado.
                    </span>
                </div>
            )}

            <table>
                <thead>
                    <tr>
                        <th>Ámbito / Carrera</th>
                        <th>Estado de Envíos</th>
                        <th>Detalle y Alcance</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem' }}>
                                Cargando estado de envío de correos...
                            </td>
                        </tr>
                    ) : (
                        <>
                            {/* Fila Interruptor Global para Super Admin */}
                            {esSuperAdmin && (
                                <tr style={{ background: '#f8fafc' }}>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center' }}>
                                            <FaGlobe style={{ color: '#00acc9', fontSize: '1.2rem', flexShrink: 0 }} />
                                            <div style={{ textAlign: 'center' }}>
                                                <strong>Interruptor General (Todo el Sistema)</strong>
                                                <div className="subtexto-celda" style={{ textAlign: 'center' }}>Aplica a todas las carreras y eventos</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {globalHabilitado ? (
                                            <span className="badge-rol rol-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <FaCheckCircle style={{ color: '#2e7d32' }} /> HABILITADO GLOBAL
                                            </span>
                                        ) : (
                                            <span className="badge-rol" style={{ background: 'rgba(211,47,47,0.12)', color: '#c62828', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <FaBan /> PAUSADO GLOBAL
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.35, maxWidth: '380px', margin: '0 auto', textAlign: 'center' }}>
                                            {globalHabilitado
                                                ? 'Los correos institucionales de toda la plataforma se procesan normalmente.'
                                                : 'Detiene todos los envíos automáticos de correos en caso de contingencia o mantenimiento.'}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            className={`btn-accion-tabla ${globalHabilitado ? 'btn-pausar-rec' : 'btn-asignar'}`}
                                            disabled={guardandoClave === 'global'}
                                            onClick={() => alternarCorreos('global')}
                                            style={{ whiteSpace: 'nowrap' }}
                                        >
                                            {globalHabilitado ? <><FaBan /> Pausar Todos</> : <><FaEnvelope /> Habilitar Todos</>}
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {/* Filas por Carrera */}
                            {listaCarreras.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '1.25rem' }}>
                                        No hay eventos activos registrados para gestionar correos.
                                    </td>
                                </tr>
                            ) : (
                                listaCarreras.map((item) => {
                                    const habilitado = Boolean(item.correos_habilitados);
                                    const esCivil = (item.carrera || '').includes('civil');
                                    const IconoCarrera = esCivil ? FaHardHat : FaLaptopCode;
                                    const colorIcono = esCivil ? '#80ba27' : '#00acc9';
                                    const guardando = guardandoClave === item.carrera;

                                    return (
                                        <tr key={item.carrera || item.id_evento}>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center' }}>
                                                    <IconoCarrera style={{ color: colorIcono, fontSize: '1.2rem', flexShrink: 0 }} />
                                                    <div style={{ textAlign: 'center' }}>
                                                        <strong>{item.carrera_etiqueta || item.carrera}</strong>
                                                        <div className="subtexto-celda" style={{ textAlign: 'center' }}>
                                                            {item.nombre_evento || `Evento #${item.id_evento}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {habilitado ? (
                                                    <span className="badge-rol rol-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <FaCheckCircle style={{ color: '#2e7d32' }} /> HABILITADO
                                                    </span>
                                                ) : (
                                                    <span className="badge-rol" style={{ background: 'rgba(211,47,47,0.1)', color: '#c62828', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <FaBan /> PAUSADO
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.35, maxWidth: '380px', margin: '0 auto', textAlign: 'center' }}>
                                                    {habilitado
                                                        ? `Se envían notificaciones de subida, asignación, rondas y recordatorios para ${item.carrera_etiqueta}.`
                                                        : `Notificaciones de correos pausadas exclusivamente para ${item.carrera_etiqueta}.`}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    className={`btn-accion-tabla ${habilitado ? 'btn-pausar-rec' : 'btn-asignar'}`}
                                                    disabled={guardando || (!globalHabilitado && !habilitado)}
                                                    onClick={() => alternarCorreos('carrera', item)}
                                                    style={{ whiteSpace: 'nowrap' }}
                                                    title={!globalHabilitado ? 'El interruptor global está pausado' : ''}
                                                >
                                                    {habilitado ? <><FaBan /> Pausar Correos</> : <><FaEnvelope /> Habilitar Correos</>}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ControlEnvioCorreos;
