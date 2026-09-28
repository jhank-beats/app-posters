import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import EditarUsuario from './EditarUsuario';
import "./roles.css";
import { API_BASE } from '../../../config.js';

const Usuarios = ({ cerrarTabla, limite = null, verMas }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estado para controlar el modal de edición de usuario
    const [usuarioAEditar, setUsuarioAEditar] = useState(null);

    // Estados para filtros
    const [filtroGeneral, setFiltroGeneral] = useState("");
    const [filtroRol, setFiltroRol] = useState("todos");

    // Orden
    const [ordenColumna, setOrdenColumna] = useState(null);
    const [ordenDir, setOrdenDir] = useState("asc");

    useEffect(() => {
        cargarUsuarios();
    }, []);

    useEffect(() => {
        aplicarFiltros();
    }, [usuarios, filtroGeneral, filtroRol, ordenColumna, ordenDir]);

    const cargarUsuarios = async () => {
        try {
            const adminId = localStorage.getItem("idUsuario");

            const url = limite
                ? `${API_BASE}/TablaUsuarios.php?admin_id=${adminId}&limite=${limite}`
                : `${API_BASE}/TablaUsuarios.php?admin_id=${adminId}`;

            const respuesta = await fetch(url);
            const datos = await respuesta.json();

            if (datos.success) {
                setUsuarios(datos.data);
            } else {
                console.error("Error del servidor:", datos.message);
            }
        } catch (error) {
            console.error("Error al cargar usuarios:", error);
        } finally {
            setLoading(false);
        }
    };

    const aplicarFiltros = () => {
        let lista = [...usuarios];

        if (filtroGeneral.trim() !== "") {
            lista = lista.filter(u => {
                const texto = filtroGeneral.toLowerCase();
                return (
                    u.nombres.toLowerCase().includes(texto) ||
                    u.apellidos.toLowerCase().includes(texto) ||
                    u.correo.toLowerCase().includes(texto) ||
                    u.carrera.toLowerCase().includes(texto) ||
                    obtenerNombreRol(u.id_rol).toLowerCase().includes(texto)
                );
            });
        }

        if (filtroRol !== "todos") {
            lista = lista.filter(u => String(u.id_rol) === filtroRol);
        }

        if (ordenColumna) {
            lista.sort((a, b) => {
                const valA = (a[ordenColumna] || "").toString().toLowerCase();
                const valB = (b[ordenColumna] || "").toString().toLowerCase();

                if (valA < valB) return ordenDir === "asc" ? -1 : 1;
                if (valA > valB) return ordenDir === "asc" ? 1 : -1;
                return 0;
            });
        }

        setUsuariosFiltrados(limite ? lista.slice(0, limite) : lista);
    };

    const cambiarOrden = (columna) => {
        if (ordenColumna === columna) {
            setOrdenDir(ordenDir === "asc" ? "desc" : "asc");
        } else {
            setOrdenColumna(columna);
            setOrdenDir("asc");
        }
    };

    const cambiarRol = async (id, nuevoRol, nombreRol) => {
        const confirmar = window.confirm(`¿Confirmar cambio a ${nombreRol}?`);
        if (!confirmar) return;

        const adminId = localStorage.getItem("idUsuario");

        try {
            const respuesta = await fetch(`${API_BASE}/TablaUsuarios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, id_rol: nuevoRol, admin_id: adminId }),
            });

            const data = await respuesta.json();
            if (data.success) {
                setUsuarios(prev =>
                    prev.map(u => (u.id === id ? { ...u, id_rol: nuevoRol } : u))
                );
                alert('✅ Rol actualizado correctamente');
            } else {
                alert('❌ ' + data.message);
            }
        } catch (error) {
            alert('❌ Error de conexión: ' + error.message);
        }
    };

    const eliminarUsuario = async (id) => {
        if (!window.confirm("¿Eliminar este usuario?")) return;

        try {
            const respuesta = await fetch(`${API_BASE}/TablaUsuarios.php`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const data = await respuesta.json();
            if (data.success) {
                setUsuarios(prev => prev.filter(u => u.id !== id));
                alert('🗑️ Usuario eliminado correctamente');
            } else {
                alert('❌ Error al eliminar: ' + data.message);
            }
        } catch (error) {
            alert('❌ Error de conexión: ' + error.message);
        }
    };

    const obtenerNombreRol = (id_rol) => {
        switch (parseInt(id_rol, 10)) {
            case 1: return "Usuario";
            case 2: return "Evaluador";
            case 3: return "Administrador";
            case 4: return "Super Admin";
            default: return "Desconocido";
        }
    };

    const obtenerOpcionesRolesDisponibles = () => {
        return [
            { value: 1, label: "Usuario" },
            { value: 2, label: "Evaluador" },
            { value: 3, label: "Administrador" },
        ];
    };

    return (
        <section id="usuarios" className={limite ? "preview-usuarios" : "todos-usuarios"}>
            {cerrarTabla && <button className="cerrar-tabla" onClick={cerrarTabla}>X</button>}
            {!limite && <h2>Gestión de Usuarios</h2>}

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th onClick={() => cambiarOrden("nombres")}>NOMBRE</th>
                            <th onClick={() => cambiarOrden("apellidos")}>APELLIDOS</th>
                            <th onClick={() => cambiarOrden("correo")}>CORREO</th>
                            <th onClick={() => cambiarOrden("carrera")}>CARRERA</th>
                            <th onClick={() => cambiarOrden("id_rol")}>ROL ACTUAL</th>
                            <th>CAMBIAR ROL</th>
                            <th>EDITAR</th>
                            <th>ELIMINAR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ textAlign: "center" }}>Cargando usuarios...</td></tr>
                        ) : usuariosFiltrados.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: "center" }}>No hay usuarios registrados</td></tr>
                        ) : (
                            usuariosFiltrados.map(usuario => (
                                <tr key={usuario.id}>
                                    <td>{usuario.nombres}</td>
                                    <td>{usuario.apellidos}</td>
                                    <td>{usuario.correo}</td>
                                    <td>{usuario.carrera}</td>
                                    <td>
                                        <span className={`badge-rol rol-${usuario.id_rol}`}>
                                            {obtenerNombreRol(usuario.id_rol)}
                                        </span>
                                    </td>
                                    <td>
                                        <select
                                            value={usuario.id_rol}
                                            onChange={(e) => {
                                                const nuevoRol = parseInt(e.target.value, 10);
                                                const nombreRol = obtenerNombreRol(nuevoRol);
                                                cambiarRol(usuario.id, nuevoRol, nombreRol);
                                            }}
                                        >
                                            {obtenerOpcionesRolesDisponibles().map(opcion => (
                                                <option key={opcion.value} value={opcion.value}>
                                                    {opcion.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            onClick={() => setUsuarioAEditar(usuario)}
                                            title="Editar información del usuario"
                                        >
                                            <FaRegPenToSquare />
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            onClick={() => eliminarUsuario(usuario.id)}
                                            title="Eliminar usuario"
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

            <div className="filtros">
                <input
                    type="text"
                    placeholder="Buscar por nombre, correo, carrera..."
                    value={filtroGeneral}
                    onChange={(e) => setFiltroGeneral(e.target.value)}
                />

                <select
                    value={filtroRol}
                    onChange={(e) => setFiltroRol(e.target.value)}
                >
                    <option value="todos">Todos los roles</option>
                    <option value="1">Usuario</option>
                    <option value="2">Evaluador</option>
                </select>

                {limite && (
                    <a
                        href="#"
                        className="ver-mas"
                        onClick={(e) => {
                            e.preventDefault();
                            if (verMas) verMas();
                        }}
                    >
                        Ver más...
                    </a>
                )}
            </div>

            {/* Modal de edición de información de usuario */}
            {usuarioAEditar && (
                <EditarUsuario
                    usuario={usuarioAEditar}
                    cerrarModal={() => setUsuarioAEditar(null)}
                    alGuardarExitoso={cargarUsuarios}
                />
            )}
        </section>
    );
};

export default Usuarios;