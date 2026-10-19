import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from "react-icons/fa";
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const SolicitudesUsuarios = ({ cerrarTabla, limite = null, verMas }) => {
    const [solicitudesRegistro, setSolicitudesRegistro] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState("");

    useEffect(() => {
        cargarSolicitudes();
    }, []);

    const cargarSolicitudes = async () => {
        try {
            // CORREGIDO: Se quitó '/backend' para apuntar correctamente a la raíz del servidor PHP
            const respuesta = await fetch(`${SERVER_URL}/api/TablaSolicitudes.php`);
            const datos = await respuesta.json();
            if (datos.success) setSolicitudesRegistro(datos.data);
        } catch (error) {
            console.error("Error al cargar solicitudes:", error);
        } finally {
            setLoading(false);
        }
    };

    const EstadoActivo = async (id, estadoActual) => {
        try {
            setSolicitudesRegistro(prev =>
                prev.map(s => (s.id === id ? { ...s, activo: estadoActual ? 0 : 1 } : s))
            );

            // CORREGIDO: Se quitó '/backend'
            const respuesta = await fetch(`${SERVER_URL}/api/TablaSolicitudes.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, activo: !estadoActual }),
            });

            const data = await respuesta.json();
            if (!data.success) alert('❌ ' + data.message);
            else await cargarSolicitudes();

        } catch (error) {
            console.error("Error:", error);
            alert("❌ Error de conexión: " + error.message);
        }
    };

    const RechazarSolicitud = async (id) => {
        if (!window.confirm("¿Rechazar esta solicitud?")) return;

        try {
            // CORREGIDO: Se quitó '/backend'
            const respuesta = await fetch(`${SERVER_URL}/api/TablaSolicitudes.php`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const data = await respuesta.json();
            if (data.success) {
                setSolicitudesRegistro(prev => prev.filter(s => s.id !== id));
            } else {
                alert("❌ Error al rechazar: " + data.message);
            }

        } catch (error) {
            console.error("Error:", error);
            alert("❌ Error de conexión: " + error.message);
        }
    };

    // Filtro general
    const solicitudesFiltradas = solicitudesRegistro.filter(s =>
        `${s.nombres} ${s.apellidos} ${s.correo} ${s.carrera}`
            .toLowerCase()
            .includes(filtro.toLowerCase())
    );

    // Si tiene límite, cortar la lista
    const solicitudesParaMostrar = limite
        ? solicitudesFiltradas.slice(0, limite)
        : solicitudesFiltradas;

    return (
        <section className={limite ? "preview-pendientes" : "todos-pendientes"}>
            {cerrarTabla && (
                <button className="cerrar-tabla" onClick={cerrarTabla}>X</button>
            )}

            {!limite && <h2>Todos los Usuarios Pendientes por Aceptación</h2>}

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>Nombres</th>
                            <th>Apellidos</th>
                            <th>Correo</th>
                            <th>Carrera</th>
                            <th>Fecha de Registro</th>
                            <th>Activo</th>
                            <th>Rechazar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: "center" }}>Cargando...</td>
                            </tr>
                        ) : solicitudesParaMostrar.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: "center" }}>No hay usuarios pendientes</td>
                            </tr>
                        ) : (
                            solicitudesParaMostrar.map(solicitud => (
                                <tr key={solicitud.id}>
                                    <td>{solicitud.nombres}</td>
                                    <td>{solicitud.apellidos}</td>
                                    <td>{solicitud.correo}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                            <span>{solicitud.carrera}</span>
                                            {solicitud.nombre_evento && (
                                                <span className="badge-evento" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                                    <span className="badge-evento-icono" aria-hidden="true">🗓️</span>
                                                    <span className="badge-evento-texto">
                                                        {solicitud.nombre_evento}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{new Date(solicitud.fecha_registro).toLocaleDateString()}</td>
                                    <td>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={solicitud.activo === 1}
                                                onChange={() => EstadoActivo(solicitud.id, solicitud.activo === 1)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </td>
                                    <td>
                                        <button className="btn-rechazar" onClick={() => RechazarSolicitud(solicitud.id)}>
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
                    placeholder="Buscar por nombre, apellido, correo o carrera..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro"
                />
                {limite && verMas && solicitudesFiltradas.length > limite && (
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

export default SolicitudesUsuarios;