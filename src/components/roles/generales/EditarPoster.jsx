import React, { useState, useEffect } from 'react';
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const EditarPoster = ({ poster, cerrarModal, alGuardarExitoso }) => {
    const [categorias, setCategorias] = useState([]);
    const [datosPoster, setDatosPoster] = useState({
        titulo: poster?.titulo || "",
        autores: poster?.autores || "",
        descripcion: poster?.descripcion || "",
        categoria: poster?.categoria || "",
        palabrasClave: poster?.palabras_clave || ""
    });
    const [cargandoGuardar, setCargandoGuardar] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        cargarCategorias();
    }, []);

    const cargarCategorias = async () => {
        try {
            const respuesta = await fetch(`${SERVER_URL}/api/Categorias.php`);
            const datos = await respuesta.json();
            if (datos.success) setCategorias(datos.data);
        } catch (error) {
            console.error("Error al cargar categorías en el modal:", error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setDatosPoster(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!datosPoster.titulo.trim()) {
            setError("El título no puede estar vacío");
            return;
        }

        setCargandoGuardar(true);

        try {
            const respuesta = await fetch(`${SERVER_URL}/api/TablaPosters.php`, {
                method: 'PUT',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: poster.id,
                    titulo: datosPoster.titulo,
                    autores: datosPoster.autores,
                    descripcion: datosPoster.descripcion,
                    categoria: datosPoster.categoria,
                    palabrasClave: datosPoster.palabrasClave
                })
            });

            const data = await respuesta.json();

            if (data.success) {
                alert("✅ Póster modificado correctamente");
                if (alGuardarExitoso) alGuardarExitoso();
                if (cerrarModal) cerrarModal();
            } else {
                setError(data.message || "Error al modificar el póster");
            }
        } catch (err) {
            console.error("❌ Error al modificar póster:", err);
            setError("Error al conectar con el servidor");
        } finally {
            setCargandoGuardar(false);
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
                    <h2>📌 Editar Póster</h2>
                    <p>Actualiza la información técnica del póster</p>
                </div>

                <form className="formularios-body" onSubmit={handleSubmit}>
                    <div className="campo-formulario"><input
                        type="text"
                        name="titulo"
                        value={datosPoster.titulo}
                        onChange={handleInputChange}
                        placeholder="📝 Título del póster"
                    /></div>

                    <div className="campo-formulario"><input
                        type="text"
                        name="autores"
                        value={datosPoster.autores}
                        onChange={handleInputChange}
                        placeholder="👥 Autores"
                    /></div>

                    <div className="campo-formulario"><select
                        name="categoria"
                        value={datosPoster.categoria}
                        onChange={handleInputChange}
                    >
                        <option value="">📁 Seleccione una categoría</option>
                        {categorias.map((cat) => (
                            <option key={cat.id_categorias} value={cat.nombre_categorias}>
                                {cat.nombre_categorias}
                            </option>
                        ))}
                    </select></div>

                    <div className="campo-formulario"><textarea
                        name="descripcion"
                        value={datosPoster.descripcion}
                        onChange={handleInputChange}
                        placeholder="📄 Descripción del póster"
                        rows="4"
                    ></textarea></div>

                    <div className="campo-formulario"><input
                        type="text"
                        name="palabrasClave"
                        value={datosPoster.palabrasClave}
                        onChange={handleInputChange}
                        placeholder="🏷️ Palabras clave"
                    /></div>

                    <button className="boton-primario" type="submit" disabled={cargandoGuardar}>
                        {cargandoGuardar ? "Guardando..." : "Guardar Cambios"}
                    </button>

                    {error && <p className="error-mensaje">{error}</p>}
                </form>
            </section>
        </div>
    );
};

export default EditarPoster;