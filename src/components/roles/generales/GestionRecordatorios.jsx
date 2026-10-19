import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from 'react-icons/fa';
import { FaRegPenToSquare } from 'react-icons/fa6';
import './roles.css';
import '../../formularios/Formulario.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const ETIQUETAS_ACCION = {
    recordatorio: '🔔 Recordatorio de calificación',
    asignar: '🎲 Asignar pósters sin evaluador',
    reasignar: '🔄 Reasignar pendientes a libres',
    informe: '📊 Generar informe de estado',
};

const GestionRecordatorios = ({ modo = 'resumen', abrirModal, cerrarModal }) => {
    const [horarios, setHorarios] = useState([]);
    const [informe, setInforme] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [alerta, setAlerta] = useState(null);

    // El formulario de Crear / Editar recordatorio inicia CERRADO por defecto
    // y solo se abre al pulsar "+ Agregar Recordatorio" o el botón "Editar" de una fila.
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [hora, setHora] = useState('08:30');
    const [accion, setAccion] = useState('recordatorio');
    const [asunto, setAsunto] = useState('Recordatorio de evaluación de pósters');
    const [mensajePersonalizado, setMensajePersonalizado] = useState(
        'Te recordamos revisar y calificar los pósters que tienes asignados en la jornada actual.'
    );
    const [activo, setActivo] = useState(true);
    const [verDetallePendientes, setVerDetallePendientes] = useState(false);
    const [mostrarAyudaBotones, setMostrarAyudaBotones] = useState(false);

    const mostrarMensaje = (tipo, texto) => {
        setAlerta({ tipo, texto });
        setTimeout(() => {
            setAlerta((prev) => (prev && prev.texto === texto ? null : prev));
        }, 7000);
    };

    const cargarDatos = async (autoCheck = false) => {
        try {
            setCargando(true);
            const qs = autoCheck ? '?auto_check=1' : '';
            const res = await fetch(`${SERVER_URL}/api/Recordatorios.php${qs}`);
            const texto = await res.text();
            let data = null;
            try {
                data = JSON.parse(texto);
            } catch {
                console.error('Respuesta no JSON de Recordatorios.php:', texto);
            }
            if (data && (data.success || data.status === 'success')) {
                setHorarios(data.horarios || []);
                setInforme(data.informe || null);
                setHistorial(data.historial || []);
            }
        } catch (err) {
            console.error('Error al cargar recordatorios:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatos(true);
    }, []);

    const abrirFormularioNuevo = () => {
        setEditandoId(null);
        setHora('08:30');
        setAccion('recordatorio');
        setAsunto('Recordatorio de evaluación de pósters');
        setMensajePersonalizado(
            'Te recordamos revisar y calificar los pósters que tienes asignados en la jornada actual.'
        );
        setActivo(true);
        setMostrarForm(true);
    };

    const abrirFormularioEdicion = (item) => {
        setEditandoId(item.id_config);
        setHora(item.hora || '08:30');
        setAccion(item.accion || 'recordatorio');
        setAsunto(item.asunto || 'Recordatorio de evaluación de pósters');
        setMensajePersonalizado(item.mensaje_personalizado || '');
        setActivo(Number(item.activo) === 1);
        setMostrarForm(true);
    };

    const cerrarFormulario = () => {
        setMostrarForm(false);
        setEditandoId(null);
    };

    const guardarHorario = async (e) => {
        e.preventDefault();
        if (!hora) {
            mostrarMensaje('error', 'Selecciona una hora válida (HH:MM).');
            return;
        }
        try {
            setProcesando(true);
            const metodo = editandoId ? 'PUT' : 'POST';
            const payload = {
                id_config: editandoId,
                hora,
                accion,
                asunto: asunto.trim() || 'Recordatorio de evaluación de pósters',
                mensaje_personalizado:
                    mensajePersonalizado.trim() ||
                    'Te recordamos revisar y calificar los pósters que tienes asignados en la jornada actual.',
                activo: activo ? 1 : 0,
                reprogramar_hoy: true,
            };

            const res = await fetch(`${SERVER_URL}/api/Recordatorios.php`, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data && (data.success || data.status === 'success')) {
                mostrarMensaje('ok', data.message || 'Horario guardado correctamente.');
                cerrarFormulario();
                await cargarDatos(false);
            } else {
                mostrarMensaje('error', (data && data.message) || 'No se pudo guardar el horario.');
            }
        } catch (err) {
            console.error('Error al guardar horario:', err);
            mostrarMensaje('error', 'Error de red al guardar el horario.');
        } finally {
            setProcesando(false);
        }
    };

    const alternarActivo = async (item) => {
        try {
            setProcesando(true);
            const nuevoEstado = Number(item.activo) === 1 ? 0 : 1;
            const res = await fetch(`${SERVER_URL}/api/Recordatorios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_config: item.id_config,
                    solo_estado: true,
                    activo: nuevoEstado,
                }),
            });
            const data = await res.json();
            if (data && (data.success || data.status === 'success')) {
                mostrarMensaje('ok', data.message || 'Estado actualizado.');
                await cargarDatos(false);
            }
        } catch (err) {
            console.error('Error al cambiar estado:', err);
        } finally {
            setProcesando(false);
        }
    };

    const eliminarHorario = async (item) => {
        if (!window.confirm(`¿Eliminar el recordatorio programado de las ${item.hora}?`)) return;
        try {
            setProcesando(true);
            const res = await fetch(`${SERVER_URL}/api/Recordatorios.php?id_config=${item.id_config}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data && (data.success || data.status === 'success')) {
                if (editandoId === item.id_config) cerrarFormulario();
                mostrarMensaje('ok', data.message || 'Horario eliminado.');
                await cargarDatos(false);
            } else {
                mostrarMensaje('error', (data && data.message) || 'No se pudo eliminar el horario.');
            }
        } catch (err) {
            console.error('Error al eliminar horario:', err);
            mostrarMensaje('error', 'Error de red al eliminar el horario.');
        } finally {
            setProcesando(false);
        }
    };

    const ejecutarAccionAhora = async (opciones = {}) => {
        try {
            setProcesando(true);
            const res = await fetch(`${SERVER_URL}/api/Recordatorios.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operacion: 'ejecutar',
                    accion: opciones.accion || 'recordatorio',
                    id_config: opciones.id_config || null,
                    asunto: opciones.asunto || asunto,
                    mensaje_personalizado: opciones.mensaje_personalizado || mensajePersonalizado,
                }),
            });
            const texto = await res.text();
            let data = null;
            try {
                data = JSON.parse(texto);
            } catch {
                throw new Error(texto || `HTTP ${res.status}`);
            }
            if (data && (data.success || data.status === 'success' || data.status === 'sin_pendientes')) {
                const tipoAlerta = data.status === 'sin_pendientes' ? 'info' : 'ok';
                mostrarMensaje(tipoAlerta, data.message || 'Operación ejecutada correctamente.');
                await cargarDatos(false);
            } else {
                mostrarMensaje('error', (data && data.message) || 'No se pudo completar la operación.');
            }
        } catch (err) {
            console.error('Error al ejecutar recordatorio:', err);
            mostrarMensaje('error', 'Error al ejecutar la acción: ' + (err.message || 'Verifica la conexión.'));
        } finally {
            setProcesando(false);
        }
    };

    const hayPendientes = informe && Number(informe.total_asignaciones_pendientes) > 0;
    const evaluadoresPendientes = (informe && informe.evaluadores_detalle) || [];

    // Modal flotante de Creación / Edición (cerrado por defecto, se abre con botón "+ Agregar" o "Editar")
    const renderModalFormulario = () => {
        if (!mostrarForm) return null;
        return (
            <div className="modal" onClick={cerrarFormulario}>
                <div
                    className="formularios"
                    style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="cerrar-formulario"
                        onClick={cerrarFormulario}
                        aria-label="Cerrar formulario"
                    >
                        X
                    </button>
                    <div className="formularios-header">
                        <span className="formularios-eyebrow">
                            {editandoId ? 'Edición de recordatorio' : 'Nuevo recordatorio'}
                        </span>
                        <h2>
                            ⏰ {editandoId ? `Editar Recordatorio (${hora})` : 'Crear Hora de Recordatorio'}
                        </h2>
                        <p>
                            Configura la hora y el mensaje personalizado. El sistema adjuntará siempre el número de
                            pósters pendientes, sus títulos y el espacio con su número (<strong>#N</strong>).
                        </p>
                    </div>

                    <form className="formularios-body" onSubmit={guardarHorario}>
                        <div className="form-recordatorio-grid">
                            <div className="campo-formulario">
                                <label htmlFor="rec-hora">Hora programada (24h)</label>
                                <input
                                    id="rec-hora"
                                    type="time"
                                    value={hora}
                                    onChange={(e) => setHora(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="campo-formulario">
                                <label htmlFor="rec-accion">Tipo de acción</label>
                                <select
                                    id="rec-accion"
                                    value={accion}
                                    onChange={(e) => setAccion(e.target.value)}
                                >
                                    <option value="recordatorio">🔔 Recordatorio de calificación</option>
                                    <option value="asignar">🎲 Asignar pósters sin evaluador</option>
                                    <option value="reasignar">🔄 Reasignar pendientes a libres</option>
                                    <option value="informe">📊 Generar informe de estado</option>
                                </select>
                            </div>
                        </div>

                        <div className="campo-formulario">
                            <label htmlFor="rec-asunto">Asunto del correo / Título de notificación</label>
                            <input
                                id="rec-asunto"
                                type="text"
                                maxLength={180}
                                value={asunto}
                                onChange={(e) => setAsunto(e.target.value)}
                                placeholder="Ej. Recordatorio de evaluación de pósters"
                                required
                            />
                        </div>

                        <div className="campo-formulario">
                            <label htmlFor="rec-mensaje">Mensaje personalizado para los evaluadores</label>
                            <textarea
                                id="rec-mensaje"
                                rows={3}
                                value={mensajePersonalizado}
                                onChange={(e) => setMensajePersonalizado(e.target.value)}
                                placeholder="Escribe el mensaje que verán los evaluadores..."
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                id="rec-activo"
                                type="checkbox"
                                checked={activo}
                                onChange={(e) => setActivo(e.target.checked)}
                                style={{ width: '18px', height: '18px', margin: 0 }}
                            />
                            <label htmlFor="rec-activo" style={{ margin: 0, cursor: 'pointer', fontWeight: 700, color: '#132740' }}>
                                Horario activo
                            </label>
                        </div>

                        {/* Vista previa en vivo */}
                        <div className="preview-recordatorio-box">
                            <span className="preview-recordatorio-eyebrow">
                                👁️ Vista previa del mensaje (correo y campana)
                            </span>
                            <div className="preview-recordatorio-content">
                                <div>
                                    <strong>{asunto || 'Recordatorio de evaluación de pósters'}</strong>{' '}
                                    <span className="badge-hora-recordatorio">⏰ {hora || '08:30'}</span>
                                </div>
                                <p style={{ margin: '6px 0' }}>
                                    {mensajePersonalizado || 'Te recordamos revisar y calificar los pósters que tienes asignados.'}
                                </p>
                                <div className="preview-recordatorio-obligatorio">
                                    <strong>📌 Datos automáticos incluidos siempre por el sistema:</strong>
                                    <div>
                                        Actualmente tienes <strong>2 pósters pendientes por calificar</strong>:
                                    </div>
                                    <ul>
                                        <li>
                                            <strong>«Título del Póster 1»</strong> —{' '}
                                            <span className="badge-ubicacion-espacio">
                                                📍 <span>Piso 1</span> <strong className="badge-ubicacion-num">#3</strong>
                                            </span>
                                        </li>
                                        <li>
                                            <strong>«Título del Póster 2»</strong> —{' '}
                                            <span className="badge-ubicacion-espacio">
                                                📍 <span>Piso 2</span> <strong className="badge-ubicacion-num">#1</strong>
                                            </span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="acciones-modal-rec">
                            <button
                                type="button"
                                className="btn-rec-secundario"
                                onClick={cerrarFormulario}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn-rec-primario"
                                disabled={procesando}
                            >
                                {editandoId ? '💾 Guardar Cambios' : '+ Guardar Recordatorio'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // VISTA RESUMEN (Primera previsualización en HomePageAdmin y HomePageSuperAdmin)
    // -----------------------------------------------------------------------
    if (modo === 'resumen') {
        return (
            <div className="contenedor-tabla">
                {alerta && (
                    <div
                        className={`alerta-recordatorio alerta-recordatorio--${alerta.tipo}`}
                        role="status"
                    >
                        {alerta.texto}
                    </div>
                )}

                {/* Estado en vivo de pósters pendientes por calificar */}
                <div className={`banner-verificacion-posters ${hayPendientes ? 'con-pendientes' : 'todo-al-dia'}`}>
                    <div className="banner-verificacion-info">
                        <strong>
                            {hayPendientes
                                ? `⚠️ Verificación actual: faltan ${informe.posters_pendientes} póster(s) por calificar (${informe.evaluadores_con_pendientes} evaluador(es) con pendientes)`
                                : '✅ Verificación actual: no faltan pósters por calificar en rondas abiertas (no se enviará ningún recordatorio)'}
                        </strong>
                        <span>
                            {informe
                                ? `Total pósters activos: ${informe.total_posters} · Al día: ${informe.posters_al_dia} · Evaluadores activos: ${informe.total_evaluadores}`
                                : 'Consultando estado de evaluaciones...'}
                        </span>
                    </div>
                    {hayPendientes && (
                        <button
                            type="button"
                            className="btn-rec-secundario"
                            onClick={() => setVerDetallePendientes(!verDetallePendientes)}
                        >
                            {verDetallePendientes ? 'Ocultar pósters pendientes' : 'Ver pósters y espacios pendientes'}
                        </button>
                    )}
                </div>

                {hayPendientes && verDetallePendientes && (
                    <div className="caja-pendientes-detalle">
                        {evaluadoresPendientes.map((ev) => (
                            <div key={ev.id_evaluador} className="item-evaluador-pendiente">
                                <div className="item-evaluador-cabecera">
                                    <strong>👤 {ev.nombre}</strong>
                                    <span className="badge-rol rol-3">
                                        Faltan {ev.posters.length} póster(s)
                                    </span>
                                </div>
                                <div className="item-evaluador-posters">
                                    {ev.posters.map((p) => (
                                        <span key={`${ev.id_evaluador}-${p.id_poster}-${p.id_ronda}`} className="chip-poster-pendiente">
                                            <strong>«{p.titulo}»</strong>
                                            <span className="badge-ubicacion-espacio">
                                                📍 <span>{p.nombre_espacio || 'Sin ubicar todavía'}</span>
                                                {p.numero_espacio && (
                                                    <strong className="badge-ubicacion-num">#{p.numero_espacio}</strong>
                                                )}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <table>
                    <thead>
                        <tr>
                            <th>Hora (24h)</th>
                            <th>Tipo</th>
                            <th>Asunto y Mensaje Personalizado</th>
                            <th>Datos Automáticos Incluidos</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>
                                    Cargando horarios de recordatorio...
                                </td>
                            </tr>
                        ) : horarios.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>
                                    No hay horarios de recordatorio configurados. Agrega el primero con el botón «+ Agregar Recordatorio».
                                </td>
                            </tr>
                        ) : (
                            horarios.map((h) => (
                                <tr key={h.id_config}>
                                    <td>
                                        <span className="badge-hora-recordatorio">⏰ {h.hora}</span>
                                    </td>
                                    <td>{ETIQUETAS_ACCION[h.accion] || h.accion}</td>
                                    <td>
                                        <div><strong>{h.asunto}</strong></div>
                                        <div className="subtexto-celda">{h.mensaje_personalizado}</div>
                                    </td>
                                    <td>
                                        <span className="subtexto-celda">
                                            Nº pendientes + Títulos + <strong>Espacio #N</strong>
                                        </span>
                                    </td>
                                    <td>
                                        {Number(h.activo) === 1 ? (
                                            <span className="badge-rol rol-2">ACTIVO</span>
                                        ) : (
                                            <span className="badge-rol rol-1">PAUSADO</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="acciones-celda-rec">
                                            <button
                                                type="button"
                                                className="btn-accion-tabla btn-ranking-tabla"
                                                disabled={procesando}
                                                onClick={() => abrirFormularioEdicion(h)}
                                                title="Editar hora y mensaje del recordatorio"
                                            >
                                                <FaRegPenToSquare /> Editar
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-accion-tabla btn-asignar"
                                                disabled={procesando}
                                                onClick={() => ejecutarAccionAhora({
                                                    accion: h.accion,
                                                    id_config: h.id_config,
                                                    asunto: h.asunto,
                                                    mensaje_personalizado: h.mensaje_personalizado,
                                                })}
                                                title="Verifica si faltan pósters y envía ahora"
                                            >
                                                Enviar ahora
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-accion-tabla btn-pausar-rec"
                                                disabled={procesando}
                                                onClick={() => alternarActivo(h)}
                                            >
                                                {Number(h.activo) === 1 ? 'Pausar' : 'Activar'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-rechazar"
                                                disabled={procesando}
                                                onClick={() => eliminarHorario(h)}
                                                title="Eliminar horario"
                                            >
                                                <FaTrashAlt />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="grupo-botones-espacios" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-rec-primario"
                        onClick={abrirFormularioNuevo}
                    >
                        + Agregar Recordatorio
                    </button>
                    {abrirModal && (
                        <button
                            type="button"
                            className="btn-rec-secundario"
                            onClick={abrirModal}
                        >
                            ⏰ Administrar Todos y Ver Bitácora
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn-rec-secundario"
                        disabled={procesando}
                        onClick={() => ejecutarAccionAhora({ accion: 'recordatorio' })}
                    >
                        🚀 Verificar Pendientes y Enviar Ahora
                    </button>
                </div>

                {renderModalFormulario()}
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // VISTA MODAL COMPLETA (tabla + bitácora + botón para abrir creación/edición)
    // -----------------------------------------------------------------------
    return (
        <div className="contenedor-modal-amplio">
            <button className="cerrar-formulario" onClick={cerrarModal} aria-label="Cerrar">
                X
            </button>

            <div className="formularios-header" style={{ paddingTop: 0, marginBottom: '1.2rem' }}>
                <span className="formularios-eyebrow">Automatización y avisos</span>
                <h2>⏰ Gestión de Recordatorios y Horarios</h2>
                <p>
                    Agrega, modifica o elimina las horas de recordatorio y personaliza el mensaje. El sistema{' '}
                    <strong>verifica primero si faltan pósters por calificar</strong> (si no faltan, no envía nada) e
                    incluye siempre la cantidad pendiente, los títulos y el espacio con su número (<strong>#N</strong>).
                </p>
            </div>

            {alerta && (
                <div className={`alerta-recordatorio alerta-recordatorio--${alerta.tipo}`} role="status">
                    {alerta.texto}
                </div>
            )}

            {/* Banner de verificación en tiempo real y acciones rápidas */}
            <div className={`banner-verificacion-posters ${hayPendientes ? 'con-pendientes' : 'todo-al-dia'}`}>
                <div className="banner-verificacion-info">
                    <strong>
                        {hayPendientes
                            ? `⚠️ Faltan ${informe.posters_pendientes} póster(s) por calificar en ${informe.evaluadores_con_pendientes} evaluador(es)`
                            : '✅ Todos los pósters asignados están calificados — no se enviará ningún recordatorio'}
                    </strong>
                    <span>
                        {informe ? informe.detalle : 'Verificando pósters pendientes...'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="button"
                        className="btn-rec-primario"
                        disabled={procesando}
                        onClick={() => ejecutarAccionAhora({ accion: 'recordatorio' })}
                    >
                        🚀 Enviar recordatorio ahora
                    </button>
                    <button
                        type="button"
                        className="btn-rec-secundario"
                        disabled={procesando}
                        onClick={() => ejecutarAccionAhora({ accion: 'asignar' })}
                        title="Busca pósters publicados que aún no tengan ningún evaluador asignado y les asigna 2 evaluadores al azar"
                    >
                        🎲 Asignar sin evaluador
                    </button>
                    <button
                        type="button"
                        className="btn-rec-secundario"
                        disabled={procesando}
                        onClick={() => ejecutarAccionAhora({ accion: 'reasignar' })}
                        title="Toma los pósters que siguen sin calificar y se los pasa a evaluadores libres que ya terminaron todos sus pósters"
                    >
                        🔄 Reasignar pendientes a libres
                    </button>
                    <button
                        type="button"
                        className="btn-accion-tabla btn-pausar-rec"
                        onClick={() => setMostrarAyudaBotones(!mostrarAyudaBotones)}
                    >
                        {mostrarAyudaBotones ? 'Ocultar ayuda' : '❓ ¿Qué hace cada botón?'}
                    </button>
                </div>
            </div>

            {mostrarAyudaBotones && (
                <div className="caja-ayuda-botones-rec">
                    <div>
                        <strong>🚀 Enviar recordatorio ahora:</strong> Primero verifica si faltan pósters por calificar en las rondas abiertas. Si todo está calificado, no envía nada. Si hay evaluadores con pendientes, les envía correo y notificación en campana con el mensaje personalizado, cuántos pósters faltan, sus títulos y su espacio con número (<code>#N</code>).
                    </div>
                    <div>
                        <strong>🎲 Asignar sin evaluador:</strong> Revisa si algún póster publicado quedó sin evaluadores asignados. Si encuentra alguno, le asigna automáticamente 2 evaluadores al azar (respetando la carrera y evitando asignárselo a su propio autor) y les avisa por correo.
                    </div>
                    <div>
                        <strong>🔄 Reasignar pendientes a libres:</strong> Pensado para el último corte de la jornada: busca los pósters que siguen sin ser calificados porque su evaluador no los calificó a tiempo, y se los reasigna automáticamente a otros evaluadores que ya terminaron de calificar todos sus pósters asignados.
                    </div>
                </div>
            )}

            {/* Barra superior de la tabla con botón para abrir el formulario de creación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
                <h3 style={{ margin: 0, color: '#132740' }}>
                    Horarios configurados ({horarios.length})
                </h3>
                <button
                    type="button"
                    className="btn-rec-primario"
                    onClick={abrirFormularioNuevo}
                >
                    + Agregar Recordatorio
                </button>
            </div>

            <div className="contenedor-tabla" style={{ margin: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th>Tipo</th>
                            <th>Asunto y Mensaje</th>
                            <th>Estado</th>
                            <th>Última ejecución</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {horarios.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>
                                    No hay horarios configurados. Usa el botón «+ Agregar Recordatorio».
                                </td>
                            </tr>
                        ) : (
                            horarios.map((h) => (
                                <tr key={h.id_config}>
                                    <td>
                                        <span className="badge-hora-recordatorio">⏰ {h.hora}</span>
                                    </td>
                                    <td>{ETIQUETAS_ACCION[h.accion] || h.accion}</td>
                                    <td>
                                        <div><strong>{h.asunto}</strong></div>
                                        <div className="subtexto-celda">{h.mensaje_personalizado}</div>
                                    </td>
                                    <td>
                                        {Number(h.activo) === 1 ? (
                                            <span className="badge-rol rol-2">ACTIVO</span>
                                        ) : (
                                            <span className="badge-rol rol-1">PAUSADO</span>
                                        )}
                                    </td>
                                    <td>
                                        {h.ultima_ejecucion ? (
                                            <div className="subtexto-celda">
                                                <div>{h.ultima_ejecucion}</div>
                                                <small>{h.ultimo_detalle}</small>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin ejecuciones aún</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="acciones-celda-rec">
                                            <button
                                                type="button"
                                                className="btn-accion-tabla btn-ranking-tabla"
                                                disabled={procesando}
                                                onClick={() => abrirFormularioEdicion(h)}
                                                title="Editar hora y mensaje del recordatorio"
                                            >
                                                <FaRegPenToSquare /> Editar
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-accion-tabla btn-asignar"
                                                disabled={procesando}
                                                onClick={() => ejecutarAccionAhora({
                                                    accion: h.accion,
                                                    id_config: h.id_config,
                                                    asunto: h.asunto,
                                                    mensaje_personalizado: h.mensaje_personalizado,
                                                })}
                                            >
                                                Enviar ahora
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-accion-tabla btn-pausar-rec"
                                                disabled={procesando}
                                                onClick={() => alternarActivo(h)}
                                            >
                                                {Number(h.activo) === 1 ? 'Pausar' : 'Activar'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-rechazar"
                                                disabled={procesando}
                                                onClick={() => eliminarHorario(h)}
                                                title="Eliminar horario"
                                            >
                                                <FaTrashAlt />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Historial reciente de ejecuciones */}
            {historial.length > 0 && (
                <>
                    <h3 style={{ marginTop: '1.5rem', marginBottom: '0.6rem', color: '#132740' }}>
                        Bitácora reciente de verificaciones y envíos
                    </h3>
                    <div className="contenedor-tabla" style={{ margin: 0 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha y Hora</th>
                                    <th>Hora Prog.</th>
                                    <th>Acción</th>
                                    <th>Enviados</th>
                                    <th>Resultado de la verificación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.slice(0, 8).map((log) => (
                                    <tr key={log.id_log}>
                                        <td>{log.ejecutado_en}</td>
                                        <td>{log.hora_programada || '—'}</td>
                                        <td>{ETIQUETAS_ACCION[log.accion] || log.accion}</td>
                                        <td><strong>{log.enviados}</strong></td>
                                        <td className="subtexto-celda">{log.detalle}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {renderModalFormulario()}
        </div>
    );
};

export default GestionRecordatorios;
