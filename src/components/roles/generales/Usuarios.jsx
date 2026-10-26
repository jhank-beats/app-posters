import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import EditarUsuario from './EditarUsuario';
import ImportarUsuariosModal from './ImportarUsuariosModal';
import "./roles.css";
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';

const Usuarios = ({ cerrarTabla, limite = null, verMas }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estado para controlar el modal de edición de usuario
    const [usuarioAEditar, setUsuarioAEditar] = useState(null);
    const [importarAbierto, setImportarAbierto] = useState(false);

    // Estados para filtros
    const [filtroGeneral, setFiltroGeneral] = useState("");
    const [filtroRol, setFiltroRol] = useState("todos");

    // Orden
    const [ordenColumna, setOrdenColumna] = useState(null);
    const [ordenDir, setOrdenDir] = useState("asc");
    const [eventosDisponibles, setEventosDisponibles] = useState([]);

    const rolSesionActual = parseInt(localStorage.getItem("id_rol") || "0", 10);

    useEffect(() => {
        cargarUsuarios();
        if (rolSesionActual === 4) {
            cargarEventos();
        }
    }, []);

    useEffect(() => {
        aplicarFiltros();
    }, [usuarios, filtroGeneral, filtroRol, ordenColumna, ordenDir]);

    const cargarEventos = async () => {
        try {
            const res = await fetch(`${API_BASE}/Eventos.php`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEventosDisponibles(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar eventos para asignar admin:", error);
        }
    };

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
                    (u.nombre_evento || "").toLowerCase().includes(texto) ||
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

    const cambiarRol = async (id, nuevoRol, nombreRol, idEventoActual = null) => {
        const confirmar = window.confirm(`¿Confirmar cambio a ${nombreRol}?`);
        if (!confirmar) return;

        const adminId = localStorage.getItem("idUsuario");

        try {
            const respuesta = await fetch(`${API_BASE}/TablaUsuarios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    id_rol: nuevoRol,
                    id_evento: idEventoActual || (nuevoRol === 3 ? (eventosDisponibles[0]?.id_evento ?? null) : null),
                    admin_id: adminId
                }),
            });

            const data = await respuesta.json();
            if (data.success) {
                await cargarUsuarios();
                alert('✅ Rol actualizado correctamente');
            } else {
                alert('❌ ' + data.message);
            }
        } catch (error) {
            alert('❌ Error de conexión: ' + error.message);
        }
    };

    const cambiarEventoAdmin = async (id, nuevoIdEvento) => {
        const adminId = localStorage.getItem("idUsuario");
        const evObj = eventosDisponibles.find(e => String(e.id_evento) === String(nuevoIdEvento));
        try {
            const respuesta = await fetch(`${API_BASE}/TablaUsuarios.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    id_rol: 3,
                    id_evento: parseInt(nuevoIdEvento, 10),
                    admin_id: adminId
                }),
            });
            const data = await respuesta.json();
            if (data.success) {
                setUsuarios(prev =>
                    prev.map(u => (u.id === id ? {
                        ...u,
                        id_evento: nuevoIdEvento,
                        nombre_evento: evObj ? evObj.nombre_evento : u.nombre_evento,
                        codigo_evento: evObj ? evObj.codigo_evento : u.codigo_evento
                    } : u))
                );
                alert(`✅ Evento asignado al administrador: ${evObj ? evObj.nombre_evento : nuevoIdEvento}`);
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
        const base = [
            { value: 1, label: "Usuario" },
            { value: 2, label: "Evaluador" },
        ];
        if (rolSesionActual === 4) {
            base.push(
                { value: 3, label: "Administrador (por evento)" }
            );
        }
        return base;
    };

    return (
        <section id="usuarios" className={limite ? "preview-usuarios" : "todos-usuarios"}>
            {cerrarTabla && <button className="cerrar-tabla" onClick={cerrarTabla}>X</button>}
            {!limite && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ margin: 0 }}>Gestión de Usuarios</h2>
                    {rolSesionActual === 4 && (
                        <button
                            type="button"
                            className="boton-primario"
                            onClick={() => setImportarAbierto(true)}
                            title="Cargar usuarios desde un archivo CSV"
                        >
                            📥 Importar CSV
                        </button>
                    )}
                </div>
            )}

            <div className="contenedor-tabla">
              <HintScrollTabla />
                <table>
                    <thead>
                        <tr>
                            <th onClick={() => cambiarOrden("nombres")}>NOMBRE</th>
                            <th onClick={() => cambiarOrden("apellidos")}>APELLIDOS</th>
                            <th onClick={() => cambiarOrden("correo")}>CORREO</th>
                            <th onClick={() => cambiarOrden("carrera")}>CARRERA</th>
                            <th onClick={() => cambiarOrden("id_rol")}>ROL ACTUAL</th>
                            <th>CAMBIAR ROL / EVENTO</th>
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
                            usuariosFiltrados.map(usuario => {
                                const esAdminEvento = parseInt(usuario.id_rol, 10) === 3;
                                const esSuperAdmin = parseInt(usuario.id_rol, 10) === 4;
                                return (
                                    <tr key={usuario.id}>
                                        <td>{usuario.nombres}</td>
                                        <td>{usuario.apellidos}</td>
                                        <td>{usuario.correo}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                <span>{usuario.carrera}</span>
                                                {usuario.nombre_evento && !esSuperAdmin && (
                                                    <span className="badge-evento" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                                        <span className="badge-evento-icono" aria-hidden="true">🗓️</span>
                                                        <span className="badge-evento-texto">
                                                            {usuario.nombre_evento}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                <span className={`badge-rol rol-${usuario.id_rol}`}>
                                                    {obtenerNombreRol(usuario.id_rol)}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {esSuperAdmin ? (
                                                <span className={`badge-rol rol-${usuario.id_rol}`}>
                                                    {obtenerNombreRol(usuario.id_rol)}
                                                </span>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <select
                                                        value={usuario.id_rol}
                                                        onChange={(e) => {
                                                            const nuevoRol = parseInt(e.target.value, 10);
                                                            const nombreRol = obtenerNombreRol(nuevoRol);
                                                            cambiarRol(usuario.id, nuevoRol, nombreRol, usuario.id_evento);
                                                        }}
                                                    >
                                                        {obtenerOpcionesRolesDisponibles().map(opcion => (
                                                            <option key={opcion.value} value={opcion.value}>
                                                                {opcion.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {esAdminEvento && rolSesionActual === 4 && eventosDisponibles.length > 0 && (
                                                        <select
                                                            value={usuario.id_evento || ""}
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    cambiarEventoAdmin(usuario.id, e.target.value);
                                                                }
                                                            }}
                                                            title="Evento que administra este usuario"
                                                            style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                                                        >
                                                            <option value="" disabled>-- Asignar evento --</option>
                                                            {eventosDisponibles.map(ev => (
                                                                <option key={ev.id_evento} value={ev.id_evento}>
                                                                    🗓️ {ev.nombre_evento} ({ev.codigo_evento})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="btn-rechazar"
                                                onClick={() => setUsuarioAEditar(usuario)}
                                                title="Editar información del usuario"
                                                disabled={esSuperAdmin}
                                            >
                                                <FaRegPenToSquare />
                                            </button>
                                        </td>
                                        <td>
                                            <button
                                                className="btn-rechazar"
                                                onClick={() => eliminarUsuario(usuario.id)}
                                                title="Eliminar usuario"
                                                disabled={[3, 4].includes(parseInt(usuario.id_rol, 10))}
                                            >
                                                <FaTrashAlt />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="filtros">
                <input
                    type="text"
                    placeholder="Buscar por nombre, correo, carrera o evento..."
                    value={filtroGeneral}
                    onChange={(e) => setFiltroGeneral(e.target.value)}
                />

                <select
                    value={filtroRol}
                    onChange={(e) => setFiltroRol(e.target.value)}
                >
                    <option value="todos">Todos los roles</option>
                    {obtenerOpcionesRolesDisponibles().map((r) => (
                        <option key={r.value} value={String(r.value)}>{r.label}</option>
                    ))}
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
                    eventosDisponibles={eventosDisponibles}
                    cerrarModal={() => setUsuarioAEditar(null)}
                    alGuardarExitoso={cargarUsuarios}
                />
            )}

            {/* Importación masiva por CSV (superadmin) */}
            {importarAbierto && (
                <ImportarUsuariosModal
                    cerrar={() => setImportarAbierto(false)}
                    onImportado={() => cargarUsuarios()}
                />
            )}
        </section>
    );
};

export default Usuarios;