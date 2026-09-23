import React, { useState, useEffect } from 'react';
import { FaTrashAlt, FaUserPlus, FaMapMarkerAlt, FaPrint, FaQrcode } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import EditarPoster from './EditarPoster';
import AsignarEvaluadorModal from './AsignarEvaluadorModal';
import AsignarEspacioModal from './AsignarEspacioModal';
import TarjetaPosterQR from './TarjetaPosterQR';
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const construirUrlArchivo = (rutaImagen) => {
    if (!rutaImagen) return null;
    const nombreArchivo = rutaImagen.split('/').pop();
    return `${SERVER_URL}/imgPosters/${encodeURIComponent(nombreArchivo)}`;
};

const MostrarPostersAdmin = ({ cerrarTabla }) => {
    const [posterParaAsignar, setPosterParaAsignar] = useState(null);
    const [posterParaEspacio, setPosterParaEspacio] = useState(null);
    const [posterAEditar, setPosterAEditar] = useState(null);
    const [posterParaQR, setPosterParaQR] = useState(null);
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
    const [filtro, setFiltro] = useState("");
    const [filtroEspacio, setFiltroEspacio] = useState("TODOS");

    useEffect(() => {
        cargarTodosPosters();
    }, []);

    const cargarTodosPosters = async () => {
        try {
            setLoading(true);
            const respuesta = await fetch(`${SERVER_URL}/api/TablaPosters.php`);
            const datos = await respuesta.json();

            if (datos.success) {
                setPosters(datos.data);
            }
        } catch (error) {
            console.error('Error al cargar los pósters:', error);
        } finally {
            setLoading(false);
        }
    };

    const eliminarPoster = async (id) => {
        if (!window.confirm("¿Está seguro de que desea eliminar lógicamente este póster?")) return;

        try {
            const respuesta = await fetch(`${SERVER_URL}/api/TablaPosters.php`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const data = await respuesta.json();
            if (data.success) {
                setPosters(prev => prev.filter(p => p.id !== id));
            } else {
                alert("❌ Error al eliminar: " + data.message);
            }
        } catch (error) {
            console.error("Error:", error);
            alert("❌ Error de conexión: " + error.message);
        }
    };

    const espaciosDisponibles = Array.from(
        new Set(posters.map(p => p.nombre_espacio).filter(Boolean))
    );

    const postersFiltrados = posters.filter(p => {
        const coincideTexto = `${p.titulo} ${p.autores} ${p.descripcion} ${p.categoria} ${p.palabras_clave} ${p.nombre_usuario || ''} ${p.nombre_espacio || ''}`
            .toLowerCase()
            .includes(filtro.toLowerCase());

        const coincideEspacio = filtroEspacio === "TODOS"
            ? true
            : filtroEspacio === "SIN_ESPACIO"
                ? !p.nombre_espacio
                : p.nombre_espacio === filtroEspacio;

        return coincideTexto && coincideEspacio;
    });

    return (
        <div className="todos-posters" style={{ width: '100%', boxSizing: 'border-box' }}>
            {cerrarTabla && (
                <button className="cerrar-tabla" onClick={cerrarTabla}>×</button>
            )}

            <h2>Gestión e Inventario de Pósters (Administrador)</h2>

            {/* Barra de Filtros */}
            <div className="filtros" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <input
                    type="text"
                    placeholder="Buscar por título, autores, categoría..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="input-filtro"
                    style={{ flex: '1', minWidth: '220px' }}
                />

                <select
                    value={filtroEspacio}
                    onChange={(e) => setFiltroEspacio(e.target.value)}
                    className="input-filtro"
                >
                    <option value="TODOS">📍 Todos los Espacios Físicos</option>
                    <option value="SIN_ESPACIO">⚠️ Sin Ubicación Asignada</option>
                    {espaciosDisponibles.map((espacio, index) => (
                        <option key={index} value={espacio}>🏛️ {espacio}</option>
                    ))}
                </select>

                <button
                    onClick={() => window.print()}
                    style={{ padding: '8px 12px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                    <FaPrint /> Imprimir
                </button>
            </div>

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Autores</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Espacio Físico</th>
                            <th>Palabras Clave</th>
                            <th>Imagen</th>
                            <th>Fecha</th>
                            <th>Usuario</th>
                            <th>Ubicación</th>
                            <th>Evaluadores</th>
                            <th>Código QR</th>
                            <th>Editar</th>
                            <th>Eliminar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="14" style={{ textAlign: "center", padding: "20px" }}>
                                    Cargando pósters...
                                </td>
                            </tr>
                        ) : postersFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="14" style={{ textAlign: "center", padding: "20px" }}>
                                    No hay pósters registrados o activos.
                                </td>
                            </tr>
                        ) : (
                            postersFiltrados.map(poster => (
                                <tr key={poster.id}>
                                    <td><strong>{poster.titulo}</strong></td>
                                    <td>{poster.autores}</td>
                                    <td className="descripcion-celda">{poster.descripcion}</td>
                                    <td><span className="badge-categoria">{poster.categoria}</span></td>

                                    <td>
                                        {poster.nombre_espacio ? (
                                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                                                🏛️ {poster.nombre_espacio}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#dc3545', fontStyle: 'italic' }}>
                                                Sin Asignar
                                            </span>
                                        )}
                                    </td>

                                    <td>{poster.palabras_clave}</td>

                                    <td>
                                        {poster.imagen ? (
                                            poster.imagen.toLowerCase().endsWith('.pdf') ? (
                                                <div
                                                    className="pdf-miniatura"
                                                    onClick={() => setImagenSeleccionada(construirUrlArchivo(poster.imagen))}
                                                    style={{ cursor: "pointer", color: '#0056b3', textDecoration: 'underline' }}
                                                >
                                                    <small>(Ver PDF)</small>
                                                </div>
                                            ) : (
                                                <img
                                                    src={construirUrlArchivo(poster.imagen)}
                                                    alt={poster.titulo}
                                                    className="img-miniatura"
                                                    onClick={() => setImagenSeleccionada(construirUrlArchivo(poster.imagen))}
                                                    style={{ cursor: "pointer", width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
                                                />
                                            )
                                        ) : (
                                            <span className="sin-imagen">Sin archivo</span>
                                        )}
                                    </td>

                                    <td>{poster.fecha_registro}</td>
                                    <td>{poster.nombre_usuario || 'Sin usuario'}</td>

                                    {/* Botón Asignar Espacio Físico */}
                                    <td>
                                        <button
                                            className="btn-accion"
                                            title="Asignar Espacio Físico"
                                            onClick={() => setPosterParaEspacio(poster)}
                                            style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            <FaMapMarkerAlt />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            title="Asignar Evaluadores"
                                            onClick={() => setPosterParaAsignar(poster)}
                                        >
                                            <FaUserPlus />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-accion"
                                            title="Ver código QR del póster"
                                            onClick={() => setPosterParaQR(poster)}
                                            style={{ background: '#6f42c1', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            <FaQrcode />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            title="Editar Póster"
                                            onClick={() => setPosterAEditar(poster)}
                                        >
                                            <FaRegPenToSquare />
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            title="Eliminar Póster"
                                            onClick={() => eliminarPoster(poster.id)}
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

            {/* Modal de visualización de archivo / imagen / PDF */}
            {imagenSeleccionada && (
                <div className="modal-imagen" onClick={() => setImagenSeleccionada(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '20px', borderRadius: '8px', position: 'relative', maxWidth: '80%', maxHeight: '85vh', overflow: 'auto' }}>
                        <button className="cerrar-modal" onClick={() => setImagenSeleccionada(null)} style={{ position: 'absolute', top: '10px', right: '15px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                        {imagenSeleccionada.toLowerCase().endsWith('.pdf') ? (
                            <iframe
                                src={imagenSeleccionada}
                                title="Póster PDF"
                                style={{ width: '80vw', height: '80vh', border: 'none' }}
                            />
                        ) : (
                            <img src={imagenSeleccionada} alt="Póster completo" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Edición */}
            {posterAEditar && (
                <div className="modal">
                    <EditarPoster
                        poster={posterAEditar}
                        cerrarModal={() => setPosterAEditar(null)}
                        alGuardarExitoso={cargarTodosPosters}
                    />
                </div>
            )}

            {/* Modal de Asignación de Evaluadores */}
            {posterParaAsignar && (
                <div className="modal">
                    <AsignarEvaluadorModal
                        poster={posterParaAsignar}
                        cerrarModal={() => {
                            setPosterParaAsignar(null);
                            cargarTodosPosters();
                        }}
                    />
                </div>
            )}

            {/* Modal de Asignación de Espacio Físico (Corregido para centrarse correctamente) */}
            {posterParaEspacio && (
                <AsignarEspacioModal
                    poster={posterParaEspacio}
                    cerrarModal={() => setPosterParaEspacio(null)}
                    alActualizar={cargarTodosPosters}
                />
            )}

            {/* Modal de Código QR - mismo diseño que Categorías */}
            {posterParaQR && (
                <div className="modal" onClick={() => setPosterParaQR(null)}>
                    <section className="formularios" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <button className="cerrar-formulario" onClick={() => setPosterParaQR(null)}>X</button>
                        <h2>📱 Código QR del Póster</h2>
                        <p>Escanea para ver la versión digital</p>
                        <TarjetaPosterQR
                            poster={posterParaQR}
                            urlDigital={construirUrlArchivo(posterParaQR.imagen) || `${window.location.origin}/poster/${posterParaQR.id}`}
                        />
                    </section>
                </div>
            )}
        </div>
    );
};

export default MostrarPostersAdmin;