import './Formulario.css'
import { useState } from 'react'

const Registro = ({ setUser, cerrarRegistro, abrirLogin }) => {
  const [nombre, setNombre] = useState("")
  const [apellidos, setApellidos] = useState("")
  const [email, setEmail] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [carrera, setCarrera] = useState("")
  const [error, setError] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validar que no estén vacíos
    if (nombre === "" || apellidos === "" || email === "" || contrasena === "" || carrera === "") {
      setError(true)
      return
    }
    setError(false)

    try {
      const response = await fetch("http://localhost:8000/api/Registro.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombres: nombre,
          apellidos: apellidos,
          correo: email,
          contrasena: contrasena,
          carrera: carrera
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
        alert("✅ " + data.message)
        setUser([nombre, apellidos, email, contrasena, carrera])
        setNombre("")
        setApellidos("")
        setEmail("")
        setContrasena("")
        setCarrera("")
        if (cerrarRegistro) cerrarRegistro()
      } else {
        alert("❌ " + data.message)
      }

    } catch (error) {
      console.error("Error al registrar:", error)
      alert("⚠️ Error al conectar con el servidor")
    }
  }

  return (
    <section className='formularios'>
      <button className='cerrar-formulario' onClick={cerrarRegistro}>X</button>
      <h2>📝 Solicitud de Registro</h2>
      <p>Completa tus datos para comenzar 🚀</p>

      <form className="contenedor-formulario" onSubmit={handleSubmit}>

        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder='👤 Nombres'
        />

        <input
          type="text"
          value={apellidos}
          onChange={e => setApellidos(e.target.value)}
          placeholder='🧾 Apellidos'
        />

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder='📧 Correo Electrónico'
        />

        <input
          type="password"
          value={contrasena}
          onChange={e => setContrasena(e.target.value)}
          placeholder='🔒 Contraseña'
        />

        <select
          value={carrera}
          onChange={e => setCarrera(e.target.value)}
          required
        >
          <option value="">🎓 Selecciona tu carrera</option>
          <option value="sistemas">💻 Ingeniería en Sistemas</option>
          <option value="civil">🏗️ Ingeniería Civil</option>
          <option value="administracion">📊 Administración de Empresas</option>
          <option value="derecho">⚖️ Derecho</option>
        </select>

        <button className='solicitar-registro' type="submit">Solicitar Registro</button>

        {/* ⚡ Cierra el formulario de registro y abre el de Login correctamente */}
        <button
          className='tiene-cuenta'
          type="button"
          onClick={() => {
            if (abrirLogin) abrirLogin()
            if (cerrarRegistro) cerrarRegistro()
          }}
        >
          ¿Ya tienes Cuenta? Inicia Sesión
        </button>

        {error && <p className="error-mensaje">Por favor, completa todos los campos.</p>}
      </form>
    </section>
  )
}

export default Registro