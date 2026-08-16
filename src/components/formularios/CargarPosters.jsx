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
      titulo === "" ||
      autores === "" ||
      descripcion === "" ||
      categoria === "" ||
      palabrasClave === "" ||
      !archivo
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
    console.log("🔍 Respuesta en texto:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
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


  return (
    <section className="formularios">
      {cerrarModal && (
        <button className="cerrar-formulario" onClick={cerrarModal}>X</button>
      )}

      <h2>🖼️ Subir Póster</h2>
      <p>Completa los datos para subir tu póster 📄</p>

      <form className="contenedor-formulario" onSubmit={handleSubmit} encType="multipart/form-data">
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="📌 Título del Póster"
        />

        <input
          type="text"
          value={autores}
          onChange={e => setAutores(e.target.value)}
          placeholder="👥 Autores del Póster"
        />

        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="📝 Descripción del Póster"
          className="textarea-form"
        />

        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
        >
          <option value="">📂 Selecciona la Categoría</option>
          <option value="desarrolloWeb">💻 Desarrollo Web</option>
          <option value="programacion">⚙️ Programación</option>
          <option value="backend">🔧 Backend</option>
          <option value="frontend">🎨 Frontend</option>
          <option value="calculo">🧮 Cálculo/Ecuaciones</option>
          <option value="estadistica">📊 Estadística</option>
        </select>

        <input
          type="text"
          value={palabrasClave}
          onChange={e => setPalabrasClave(e.target.value)}
          placeholder="🔑 Palabras Clave"
        />

        <input
          type="file"
          onChange={e => setArchivo(e.target.files[0])}
          accept=".pdf,.jpg,.png"
          className="input-archivo"
        />

        <button className="boton-subir" type="submit">Subir Póster</button>
        {error && <p className="error-mensaje">Por favor, completa todos los campos.</p>}
      </form>

    </section>
  )
}

export default CargarPoster
