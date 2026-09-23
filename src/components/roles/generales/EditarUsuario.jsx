import React, { useState } from 'react';
import './roles.css';

const SERVER_URL = `http://${window.location.hostname}:8000`;

const EditarUsuario = ({ usuario, cerrarModal, alGuardarExitoso }) => {
    const [datosUsuario, setDatosUsuario] = useState({
        nombres: usuario?.nombres || "",
        apellidos: usuario?.apellidos || "",
        correo: usuario?.correo || "",
        carrera: usuario?.carrera || ""
    });
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");

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
            const respuesta = await fetch(`${SERVER_URL}/api/TablaUsuarios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: usuario.id,
                    admin_id: adminId,
                    nombres: datosUsuario.nombres,
                    apellidos: datosUsuario.apellidos,
                    correo: datosUsuario.correo,
                    carrera: datosUsuario.carrera
                })
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
                        value={datosUsuario.carrera}
                        onChange={handleInputChange}
                    >
                        <option value="">🎓 Selecciona tu carrera</option>
                        <option value="sistemas">💻 Ingeniería en Sistemas</option>
                        <option value="civil">🏗️ Ingeniería Civil</option>
                        <option value="administracion">📊 Administración de Empresas</option>
                        <option value="derecho">⚖️ Derecho</option>
                    </select></div>

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