import './Formulario.css'
import { useState } from 'react'

const CargarPoster = ({ onPosterUpload, cerrarModal }) => {
  const [titulo, setTitulo] = useState("")
  const [autores, setAutores] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [categoria, setCategoria] = useState("")
  const [palabrasClave, setPalabrasClave] = useState("")
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);

    const idUsuario = localStorage.getItem("idUsuario");
    if (!idUsuario) {
      alert("⚠️ Error: No has iniciado sesión. No puedes subir un póster.")
      return;
    }
    if (
      titulo === "" || autores === "" || descripcion === "" ||
      categoria === "" || palabrasClave === "" || !archivo
    ) {
      setError(true);
      return;
    }
    setError(false);

    const formData = new FormData();
    formData.append("titulo", titulo);
    formData.append("autores", autores);
    formData.append("descripcion", descripcion);
    formData.append("categoria", categoria);
    formData.append("palabrasClave", palabrasClave);
    formData.append("archivo", archivo);
    formData.append("id_usuario", idUsuario);

    try {
      const response = await fetch("http://localhost:8000/api/SubirPosters.php", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        alert("⚠️ El servidor no devolvió JSON válido. Revisa la consola.");
        return;
      }

      if (data.status === "success") {
        alert("✅ " + data.message);
        setTitulo("")
        setAutores("")
        setDescripcion("")
        setCategoria("")
        setPalabrasClave("")
        setArchivo(null)
        if (onPosterUpload) onPosterUpload(data.poster);
      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      console.error("Error al subir el póster:", error);
      alert("⚠️ Error al conectar con el servidor");
    }
  };

  const contenido = (
    <>
        {cerrarModal && (
          <button className="cerrar-formulario" onClick={cerrarModal}>X</button>
        )}

        <div className="formularios-header">
          <span className="formularios-eyebrow">Subir Póster</span>
          <h2>🖼️ Publica tu Trabajo</h2>
          <p>Completa los datos para subir tu póster</p>
        </div>

        <form className="formularios-body" onSubmit={handleSubmit} encType="multipart/form-data">
        <div className="campo-formulario">
          <input
            type="text"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="📌 Título del Póster"
            required
          />
        </div>

        <div className="campo-formulario">
          <input
            type="text"
            value={autores}
            onChange={e => setAutores(e.target.value)}
            placeholder="👥 Autores del Póster"
            required
          />
        </div>

        <div className="campo-formulario">
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="📝 Descripción del Póster"
            required
          />
        </div>

        <div className="campo-formulario">
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            required
          >
            <option value="">📂 Selecciona la Categoría</option>
            <option value="desarrolloWeb">💻 Desarrollo Web</option>
            <option value="programacion">⚙️ Programación</option>
            <option value="backend">🔧 Backend</option>
            <option value="frontend">🎨 Frontend</option>
            <option value="calculo">🧮 Cálculo/Ecuaciones</option>
            <option value="estadistica">📊 Estadística</option>
          </select>
        </div>

        <div className="campo-formulario">
          <input
            type="text"
            value={palabrasClave}
            onChange={e => setPalabrasClave(e.target.value)}
            placeholder="🔑 Palabras Clave"
            required
          />
        </div>

        <div className="campo-formulario">
          <input
            type="file"
            onChange={e => setArchivo(e.target.files[0])}
            accept=".pdf,.jpg,.png"
            required
          />
        </div>

        {error && <p className="error-mensaje">Por favor, completa todos los campos.</p>}

        <button className="boton-primario" type="submit">Subir Póster</button>
      </form>
    </>
  );

  // Modo modal (desde HomePageUsuario): solo la tarjeta centrada, más ancha
  if (cerrarModal) {
    return <div className="formularios" style={{ maxWidth: '560px', width: '100%' }}>{contenido}</div>;
  }
  // Modo página standalone (/CargarPosters): centrado en la página
  return (
    <section className="formularios-page">
      <div className="formularios">{contenido}</div>
    </section>
  )
}

export default CargarPoster
