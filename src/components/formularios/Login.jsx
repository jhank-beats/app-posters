/* Contraseña para todos los usuarios: usuario123 */

import './Formulario.css'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveSession } from '../../auth.js'
import { API_BASE } from '../../config.js'

const Login = ({ setUser, cerrarLogin, abrirRegistro }) => {
    const [email, setEmail] = useState("")
    const [contrasena, setContrasena] = useState("")
    const [error, setError] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (email === "" || contrasena === "") {
            setError(true)
            return
        }
        setError(false)

        try {
            const response = await fetch(`${API_BASE}/InicioSesion.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    correo: email,
                    contrasena: contrasena
                })
            })

            const text = await response.text()
            let data

            try {
                data = JSON.parse(text)
            } catch (err) {
                console.error("❌ La respuesta no es un JSON válido:", err)
                alert("Error al procesar la respuesta del servidor")
                return
            }

            if (data.status === "success") {
                if (!data.token) {
                    alert("⚠️ El servidor no emitió token de sesión. Avisa al administrador.");
                    return;
                }
                saveSession({ token: data.token, usuario: data.usuario });
                setUser({
                    id: data.usuario.id,
                    nombres: data.usuario.nombres,
                    apellidos: data.usuario.apellidos,
                    correo: data.usuario.correo,
                    id_rol: data.usuario.id_rol
                })

                if (cerrarLogin) cerrarLogin()
                alert("✅ " + data.message)

                switch (parseInt(data.usuario.id_rol)) {
                    case 1: navigate('/usuario'); break
                    case 2: navigate('/evaluador'); break
                    case 3: navigate('/admin'); break
                    case 4: navigate('/superadmin'); break
                    default: navigate('/'); console.error("Rol no reconocido:", data.usuario.id_rol)
                }
            } else {
                alert("❌ " + data.message)
            }
        } catch (error) {
            console.error("Error al iniciar sesión:", error)
            alert("⚠️ Error al conectar con el servidor (" + API_BASE + "): " + (error?.message || error))
        }
    }

    return (
        <div className="formularios">
            <button className="cerrar-formulario" onClick={cerrarLogin}>X</button>

            <div className="formularios-header">
                <span className="formularios-eyebrow">Inicio de Sesión</span>
                <h2>🔐 Bienvenido</h2>
                <p>Introduce tus datos para continuar</p>
            </div>

            <form className="formularios-body" onSubmit={handleSubmit}>
                <div className="campo-formulario">
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="📧 Correo Electrónico"
                        required
                    />
                </div>

                <div className="campo-formulario">
                    <input
                        type="password"
                        value={contrasena}
                        onChange={e => setContrasena(e.target.value)}
                        placeholder="🔒 Contraseña"
                        required
                    />
                </div>

                {error && <p className="error-mensaje">Por favor, completa todos los campos.</p>}

                <button className="boton-primario" type="submit">Iniciar Sesión</button>

                <div className="formulario-texto">
                    <button
                        type="button"
                        onClick={() => {
                            if (cerrarLogin) cerrarLogin();
                            if (abrirRegistro) abrirRegistro();
                        }}
                    >
                        ¿No tienes cuenta? Regístrate
                    </button>
                </div>
            </form>
        </div>
    )
}

export default Login
