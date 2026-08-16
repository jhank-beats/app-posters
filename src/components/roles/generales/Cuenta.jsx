import React, { useState, useEffect } from 'react';
import './roles.css'

const Cuenta = ({ cerrarCuenta }) => {
    const [datosUsuario, setDatosUsuario] = useState({
        nombres: "",
        apellidos: "",
        correo: "",
        carrera: ""
    });
    const [contrasenaActual, setContrasenaActual] = useState("");
    const [contrasenaNueva, setContrasenaNueva] = useState("");
    const [confirmarContrasena, setConfirmarContrasena] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cambiarContrasena, setCambiarContrasena] = useState(false);

    useEffect(() => {
        cargarDatosUsuario();
    }, []);

    const cargarDatosUsuario = async () => {
        const idUsuario = localStorage.getItem("idUsuario");
        console.log("🔍 ID Usuario desde localStorage:", idUsuario);
        
        if (!idUsuario) {
            setError("No se encontró el ID de usuario en el almacenamiento local");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/GestionarCuenta.php?id=${idUsuario}`);
            console.log("📡 Response status:", response.status);
            
            const data = await response.json();
            console.log("📊 Datos recibidos:", data);

            if (data.success) {
                setDatosUsuario({
                    nombres: data.usuario.nombres || "",
                    apellidos: data.usuario.apellidos || "",
                    correo: data.usuario.correo || "",
                    carrera: data.usuario.carrera || ""
                });
            } else {
                setError(data.message);
            }
        } catch (error) {
            console.error("❌ Error al cargar datos:", error);
            setError("Error al conectar con el servidor");
        } finally {
            setLoading(false);
        }
    };

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

        const idUsuario = localStorage.getItem("idUsuario");
        if (!idUsuario) {
            setError("No se encontró el ID de usuario");
            return;
        }

        // Validar campos vacíos
        if (!datosUsuario.nombres || !datosUsuario.apellidos || !datosUsuario.correo || !datosUsuario.carrera) {
            setError("Todos los campos son obligatorios");
            return;
        }

        // Validar cambio de contraseña si está activado
        if (cambiarContrasena) {
            if (!contrasenaActual || !contrasenaNueva || !confirmarContrasena) {
                setError("Debes completar todos los campos de contraseña");
                return;
            }

            if (contrasenaNueva !== confirmarContrasena) {
                setError("Las contraseñas nuevas no coinciden");
                return;
            }

            if (contrasenaNueva.length < 6) {
                setError("La nueva contraseña debe tener al menos 6 caracteres");
                return;
            }
        }

        try {
            const payload = {
                id: idUsuario,
                nombres: datosUsuario.nombres,
                apellidos: datosUsuario.apellidos,
                correo: datosUsuario.correo,
                carrera: datosUsuario.carrera
            };

            // Solo agregar contraseñas si se está cambiando
            if (cambiarContrasena) {
                payload.contrasenaActual = contrasenaActual;
                payload.contrasenaNueva = contrasenaNueva;
            }

            const response = await fetch("http://localhost:8000/api/GestionarCuenta.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                alert("✅ " + data.message);
                
                // Actualizar el nombre en localStorage si cambió
                const nombreCompleto = datosUsuario.nombres + " " + datosUsuario.apellidos;
                localStorage.setItem("nombreUsuario", nombreCompleto);

                // Limpiar campos de contraseña
                setContrasenaActual("");
                setContrasenaNueva("");
                setConfirmarContrasena("");
                setCambiarContrasena(false);

                if (cerrarCuenta) cerrarCuenta();
            } else {
                setError(data.message);
            }
        } catch (error) {
            console.error("Error al actualizar datos:", error);
            setError("Error al conectar con el servidor");
        }
    };

    if (loading) {
        return (
            <section className="formularios">
                {cerrarCuenta && (
                    <button className="cerrar-formulario" onClick={cerrarCuenta}>X</button>
                )}
                <p style={{ textAlign: 'center', padding: '20px' }}>Cargando datos...</p>
            </section>
        );
    }

    return (
        <section className="formularios">
            {cerrarCuenta && (
                <button className="cerrar-formulario" onClick={cerrarCuenta}>X</button>
            )}

            <h2>👤 Mi Cuenta</h2>
            <p>Actualiza tu información personal</p>

            <form className="contenedor-formulario" onSubmit={handleSubmit}>
                <input
                    type="text"
                    name="nombres"
                    value={datosUsuario.nombres}
                    onChange={handleInputChange}
                    placeholder="📝 Nombres"
                />

                <input
                    type="text"
                    name="apellidos"
                    value={datosUsuario.apellidos}
                    onChange={handleInputChange}
                    placeholder="📝 Apellidos"
                />

                <input
                    type="email"
                    name="correo"
                    value={datosUsuario.correo}
                    onChange={handleInputChange}
                    placeholder="📧 Correo Electrónico"
                />

                <select
                    name="carrera"
                    value={datosUsuario.carrera}
                    onChange={handleInputChange}
                >
                    <option value="">🎓 Selecciona tu carrera</option>
                    <option value="sistemas">💻 Ingeniería en Sistemas</option>
                    <option value="civil">🏗️ Ingeniería Civil</option>
                    <option value="administracion">📊 Administración de Empresas</option>
                    <option value="derecho">⚖️ Derecho</option>
                </select>

                <div className="cambiar-contrasena-seccion">
                    <label>
                        <input
                            type="checkbox"
                            checked={cambiarContrasena}
                            onChange={(e) => setCambiarContrasena(e.target.checked)}
                        />
                        {' '}¿Deseas cambiar tu contraseña?
                    </label>
                </div>

                {cambiarContrasena && (
                    <>
                        <input
                            type="password"
                            value={contrasenaActual}
                            onChange={(e) => setContrasenaActual(e.target.value)}
                            placeholder="🔒 Contraseña Actual"
                        />

                        <input
                            type="password"
                            value={contrasenaNueva}
                            onChange={(e) => setContrasenaNueva(e.target.value)}
                            placeholder="🔑 Nueva Contraseña"
                        />

                        <input
                            type="password"
                            value={confirmarContrasena}
                            onChange={(e) => setConfirmarContrasena(e.target.value)}
                            placeholder="🔑 Confirmar Nueva Contraseña"
                        />
                    </>
                )}

                <button className="solicitar-registro" type="submit">
                    Guardar Cambios
                </button>

                {error && <p className="error-mensaje">{error}</p>}
            </form>
        </section>
    );
};

export default Cuenta;