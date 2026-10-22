import React, { useState } from 'react';
import './roles.css';
import { API_BASE } from '../../../config.js';


const EditarUsuario = ({ usuario, eventosDisponibles = [], cerrarModal, alGuardarExitoso }) => {
    const [datosUsuario, setDatosUsuario] = useState({
        nombres: usuario?.nombres || "",
        apellidos: usuario?.apellidos || "",
        correo: usuario?.correo || "",
        carrera: usuario?.carrera || "",
        id_evento: usuario?.id_evento || ""
    });
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const rolSesionActual = parseInt(localStorage.getItem("id_rol") || "0", 10);
    const esAdminObjetivo = parseInt(usuario?.id_rol || "0", 10) === 3;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setDatosUsuario(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const adminId = localStorage.getItem("idUsuario");
        if (!adminId) {
            setError("No se encontró el ID del administrador en el sistema");
            return;
        }

        // Validar campos vacíos
        if (!datosUsuario.nombres || !datosUsuario.apellidos || !datosUsuario.correo || !datosUsuario.carrera) {
            setError("Todos los campos son obligatorios");
            return;
        }

        setCargando(true);

        try {
            const payload = {
                id: usuario.id,
                admin_id: adminId,
                nombres: datosUsuario.nombres,
                apellidos: datosUsuario.apellidos,
                correo: datosUsuario.correo,
                carrera: datosUsuario.carrera
            };
            if (rolSesionActual === 4 && esAdminObjetivo) {
                payload.id_evento = datosUsuario.id_evento ? parseInt(datosUsuario.id_evento, 10) : null;
            }

            const respuesta = await fetch(`${API_BASE}/TablaUsuarios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await respuesta.json();

            if (data.success) {
                alert("✅ Información del usuario actualizada correctamente");
                if (alGuardarExitoso) alGuardarExitoso();
                if (cerrarModal) cerrarModal();
            } else {
                setError(data.message || "Error al actualizar la información");
            }
        } catch (err) {
            console.error("❌ Error al actualizar datos:", err);
            setError("Error al conectar con el servidor");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="modal">
            <section className="formularios">
                {cerrarModal && (
                    <button className="cerrar-formulario" onClick={cerrarModal}>X</button>
                )}

                <div className="formularios-header">
                    <span className="formularios-eyebrow">Edición</span>
                    <h2>✏️ Editar Usuario</h2>
                    <p>Modifica la información general del usuario seleccionado</p>
                </div>

                <form className="formularios-body" onSubmit={handleSubmit}>
                    <div className="campo-formulario"><input
                        type="text"
                        name="nombres"
                        value={datosUsuario.nombres}
                        onChange={handleInputChange}
                        placeholder="📝 Nombres"
                    /></div>

                    <div className="campo-formulario"><input
                        type="text"
                        name="apellidos"
                        value={datosUsuario.apellidos}
                        onChange={handleInputChange}
                        placeholder="📝 Apellidos"
                    /></div>

                    <div className="campo-formulario"><input
                        type="email"
                        name="correo"
                        value={datosUsuario.correo}
                        onChange={handleInputChange}
                        placeholder="📧 Correo Electrónico"
                    /></div>

                    <div className="campo-formulario"><select
                        name="carrera"
                        value={datosUsuario.carrera.toLowerCase().includes("civil") ? "Ingeniería Civil" : (datosUsuario.carrera ? "Ingeniería de Sistemas" : "")}
                        onChange={handleInputChange}
                    >
                        <option value="">🎓 Selecciona tu carrera</option>
                        <option value="Ingeniería de Sistemas">💻 Ingeniería de Sistemas</option>
                        <option value="Ingeniería Civil">🏗️ Ingeniería Civil</option>
                    </select></div>

                    {rolSesionActual === 4 && esAdminObjetivo && eventosDisponibles.length > 0 && (
                        <div className="campo-formulario">
                            <select
                                name="id_evento"
                                value={datosUsuario.id_evento}
                                onChange={handleInputChange}
                            >
                                <option value="">🗓️ Selecciona el evento a administrar</option>
                                {eventosDisponibles.map(ev => (
                                    <option key={ev.id_evento} value={ev.id_evento}>
                                        🗓️ {ev.nombre_evento} ({ev.codigo_evento})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button className="boton-primario" type="submit" disabled={cargando}>
                        {cargando ? "Guardando..." : "Guardar Cambios"}
                    </button>

                    {error && <p className="error-mensaje">{error}</p>}
                </form>
            </section>
        </div>
    );
};

export default EditarUsuario;