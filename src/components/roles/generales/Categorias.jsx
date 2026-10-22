import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import "./roles.css";
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';

const Categorias = ({ cerrarTabla, limite = null, verMas }) => {
    const [solicitudesRegistro, setSolicitudesRegistro] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState("");
    const [mostrarModal, setMostrarModal] = useState(false);
    const [nombreCategoria, setNombreCategoria] = useState("");
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        cargarCategorias();
    }, []);

    const cargarCategorias = async () => {
        try {
            const respuesta = await fetch(`${API_BASE}/Categorias.php`);
            const datos = await respuesta.json();
            if (datos.success) setSolicitudesRegistro(datos.data);
        } catch (error) {
            console.error("Error al cargar categorías:", error);
        } finally {
            setLoading(false);
        }
    };

    const ModificarCategorias = (categoria) => {
        setCategoriaSeleccionada(categoria.id_categorias);
        setNombreCategoria(categoria.nombre_categorias);
        setError("");
        setMostrarModal(true);
    };

    const RechazarSolicitud = async (id) => {
        if (!window.confirm("¿Eliminar categoría?")) return;

        try {
            const respuesta = await fetch(`${API_BASE}/Categorias.php`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const data = await respuesta.json();
            if (data.success) {
                setSolicitudesRegistro(prev => prev.filter(s => s.id_categorias !== id));
            } else {
                alert("❌ Error al eliminar: " + data.message);
            }

        } catch (error) {
            console.error("Error:", error);
            alert("❌ Error de conexión: " + error.message);
        }
    };

    const guardarCategoria = async (e) => {
        e.preventDefault();
        setError("");

        if (!nombreCategoria.trim()) {
            setError("El nombre de la categoría es obligatorio");
            return;
        }

        try {
            const metodo = categoriaSeleccionada ? "PUT" : "POST";

            const respuesta = await fetch(`${API_BASE}/Categorias.php`, {
                method: metodo,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id_categorias: categoriaSeleccionada,
                    nombre_categorias: nombreCategoria
                })
            });

            const data = await respuesta.json();

            if (data.success) {
                alert("✅ Categoría guardada correctamente");
                setMostrarModal(false);
                setNombreCategoria("");
                setCategoriaSeleccionada(null);
                cargarCategorias();
            } else {
                setError(data.message || "Error al guardar la categoría");
            }
        } catch (err) {
            console.error(err);
            setError("Error al conectar con el servidor");
        }
    };

    const categoriasFiltradas = solicitudesRegistro.filter(cat =>
        cat.nombre_categorias.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <section className={limite ? "preview-pendientes" : "todos-pendientes"}>
            {cerrarTabla && (
                <button className="cerrar-tabla" onClick={cerrarTabla}>X</button>
            )}

            {!limite && <h2>Gestión de Categorías</h2>}

            <div className="contenedor-tabla">
              <HintScrollTabla />
                <table>
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>Fecha Registro</th>
                            <th>Modificar</th>
                            <th>Eliminar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: "center" }}>Cargando...</td>
                            </tr>
                        ) : categoriasFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: "center" }}>No hay categorías registradas</td>
                            </tr>
                        ) : (
                            categoriasFiltradas.map((categoria) => (
                                <tr key={categoria.id_categorias}>
                                    <td>{categoria.nombre_categorias}</td>
                                    <td>{categoria.fecha_registro_categorias}</td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            onClick={() => ModificarCategorias(categoria)}
                                            title="Modificar categoría"
                                        >
                                            <FaRegPenToSquare />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            onClick={() => RechazarSolicitud(categoria.id_categorias)}
                                            title="Eliminar categoría"
                                        >
                                            <FaTrashAlt />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '15px' }}>
                <button
                    className='boton-agregar-mas'
                    onClick={() => {
                        setCategoriaSeleccionada(null);
                        setNombreCategoria("");
                        setError("");
                        setMostrarModal(true);
                    }}
                >
                    + Agregar Categoría
                </button>
            </div>

            {/* Modal estilizado según el diseño de Cuenta */}
            {mostrarModal && (
                <div className="modal">
                    <section className="formularios">
                        <button
                            className='cerrar-formulario'
                            onClick={() => setMostrarModal(false)}
                        >X</button>

                        <h2>📁 {categoriaSeleccionada ? "Editar Categoría" : "Agregar Categoría"}</h2>
                        <p>{categoriaSeleccionada ? "Modifica el nombre de la categoría" : "Crea una nueva categoría para los pósters"}</p>

                        <form className="contenedor-formulario" onSubmit={guardarCategoria}>
                            <input
                                type="text"
                                placeholder="🏷️ Nombre de la categoría"
                                value={nombreCategoria}
                                onChange={(e) => setNombreCategoria(e.target.value)}
                            />

                            <button className="solicitar-registro" type="submit">
                                Guardar Cambios
                            </button>

                            {error && <p className="error-mensaje">{error}</p>}
                        </form>
                    </section>
                </div>
            )}

            <div className="filtros">
                <input
                    type="text"
                    placeholder="Buscar por categoría..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro"
                />
                {limite && verMas && categoriasFiltradas.length > limite && (
                    <a href="#" className="ver-mas" onClick={(e) => {
                        e.preventDefault();
                        verMas();
                    }}>
                        Ver más...
                    </a>
                )}
            </div>

        </section>
    );
};

export default Categorias;