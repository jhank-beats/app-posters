import React, { useState, useEffect } from 'react';
import './roles.css';
import '../../formularios/Formulario.css';
import { API_BASE } from '../../../config.js';

const Cuenta = ({ cerrarCuenta }) => {
    const [datosUsuario, setDatosUsuario] = useState({ nombres: "", apellidos: "", correo: "", carrera: "" });
    const [contrasenaActual, setContrasenaActual] = useState("");
    const [contrasenaNueva, setContrasenaNueva] = useState("");
    const [confirmarContrasena, setConfirmarContrasena] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cambiarContrasena, setCambiarContrasena] = useState(false);

    useEffect(() => { cargarDatosUsuario(); }, []);

    const cargarDatosUsuario = async () => {
        const idUsuario = localStorage.getItem("idUsuario");
        if (!idUsuario) { setError("No se encontró el ID de usuario en el almacenamiento local"); setLoading(false); return; }
        try {
            const response = await fetch(`${API_BASE}/GestionarCuenta.php?id=${idUsuario}`);
            const data = await response.json();
            if (data.success) setDatosUsuario({ nombres: data.usuario.nombres || "", apellidos: data.usuario.apellidos || "", correo: data.usuario.correo || "", carrera: data.usuario.carrera || "" });
            else setError(data.message);
        } catch { setError("Error al conectar con el servidor"); }
        finally { setLoading(false); }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setDatosUsuario(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError("");
        const idUsuario = localStorage.getItem("idUsuario");
        if (!idUsuario) { setError("No se encontró el ID de usuario"); return; }
        if (!datosUsuario.nombres || !datosUsuario.apellidos || !datosUsuario.correo || !datosUsuario.carrera) { setError("Todos los campos son obligatorios"); return; }
        if (cambiarContrasena) {
            if (!contrasenaActual || !contrasenaNueva || !confirmarContrasena) { setError("Debes completar todos los campos de contraseña"); return; }
            if (contrasenaNueva !== confirmarContrasena) { setError("Las contraseñas nuevas no coinciden"); return; }
            if (contrasenaNueva.length < 6) { setError("La nueva contraseña debe tener al menos 6 caracteres"); return; }
        }
        try {
            const payload = { id: idUsuario, nombres: datosUsuario.nombres, apellidos: datosUsuario.apellidos, correo: datosUsuario.correo, carrera: datosUsuario.carrera };
            if (cambiarContrasena) { payload.contrasenaActual = contrasenaActual; payload.contrasenaNueva = contrasenaNueva; }
            const response = await fetch(`${API_BASE}/GestionarCuenta.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await response.json();
            if (data.success) {
                alert("✅ " + data.message);
                localStorage.setItem("nombreUsuario", datosUsuario.nombres + " " + datosUsuario.apellidos);
                setContrasenaActual(""); setContrasenaNueva(""); setConfirmarContrasena(""); setCambiarContrasena(false);
                if (cerrarCuenta) cerrarCuenta();
            } else setError(data.message);
        } catch { setError("Error al conectar con el servidor"); }
    };

    if (loading) {
        return (
            <div className="formularios">
                {cerrarCuenta && (<button className="cerrar-formulario" onClick={cerrarCuenta}>X</button>)}
                <p style={{ textAlign: 'center', padding: '20px' }}>Cargando datos...</p>
            </div>
        );
    }

    return (
        <div className="formularios">
            {cerrarCuenta && (<button className="cerrar-formulario" onClick={cerrarCuenta}>X</button>)}
            <div className="formularios-header">
                <span className="formularios-eyebrow">Cuenta</span>
                <h2>👤 Mi Cuenta</h2>
                <p>Actualiza tu información personal</p>
            </div>

            <form className="formularios-body" onSubmit={handleSubmit}>
                <div className="campo-formulario"><input type="text" name="nombres" value={datosUsuario.nombres} onChange={handleInputChange} placeholder="📝 Nombres" /></div>
                <div className="campo-formulario"><input type="text" name="apellidos" value={datosUsuario.apellidos} onChange={handleInputChange} placeholder="📝 Apellidos" /></div>
                <div className="campo-formulario"><input type="email" name="correo" value={datosUsuario.correo} onChange={handleInputChange} placeholder="📧 Correo Electrónico" /></div>
                <div className="campo-formulario">
                    <select name="carrera" value={datosUsuario.carrera} onChange={handleInputChange}>
                        <option value="">🎓 Selecciona tu carrera</option>
                        <option value="sistemas">💻 Ingeniería en Sistemas</option>
                        <option value="civil">🏗️ Ingeniería Civil</option>
                        <option value="administracion">📊 Administración de Empresas</option>
                        <option value="derecho">⚖️ Derecho</option>
                    </select>
                </div>

                <div className="cambiar-contrasena-seccion" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f5f7f8', borderRadius: '10px', border: '1px solid rgba(19,39,64,0.06)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#132740', cursor: 'pointer' }}>
                        <input type="checkbox" checked={cambiarContrasena} onChange={(e) => setCambiarContrasena(e.target.checked)} />
                        ¿Deseas cambiar tu contraseña?
                    </label>
                </div>

                {cambiarContrasena && (
                    <>
                        <div className="campo-formulario"><input type="password" value={contrasenaActual} onChange={(e) => setContrasenaActual(e.target.value)} placeholder="🔒 Contraseña Actual" /></div>
                        <div className="campo-formulario"><input type="password" value={contrasenaNueva} onChange={(e) => setContrasenaNueva(e.target.value)} placeholder="🔑 Nueva Contraseña" /></div>
                        <div className="campo-formulario"><input type="password" value={confirmarContrasena} onChange={(e) => setConfirmarContrasena(e.target.value)} placeholder="🔑 Confirmar Nueva Contraseña" /></div>
                    </>
                )}

                <button className="boton-primario" type="submit">Guardar Cambios</button>
                {error && <p className="error-mensaje">{error}</p>}
            </form>
        </div>
    );
};

export default Cuenta;
