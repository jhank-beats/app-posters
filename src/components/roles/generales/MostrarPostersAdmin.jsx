import React, { useState, useEffect } from 'react';
import { FaRegPenToSquare, FaTrashAlt, FaMapMarkerAlt, FaPrint } from 'react-icons/fa';
import AsignarEspacioModal from '../generales/AsignarEspacioModal.jsx';
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const construirUrlArchivo = (rutaImagen) => {
    if (!rutaImagen) return null;
    const nombreArchivo = rutaImagen.split('/').pop();
    return `${SERVER_URL}/imgPosters/${encodeURIComponent(nombreArchivo)}`;
};

const MostrarPostersAdmin = () => {
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroTexto, setFiltroTexto] = useState("");
    const [filtroEspacio, setFiltroEspacio] = useState("TODOS");

    // Modales
    const [posterAEspacio, setPosterAEspacio] = useState(null);
    const [imagenSeleccionada, setImagenSeleccionada] = useState(null);

    useEffect(() => {
        cargarPosters();
    }, []);

    const cargarPosters = async () => {
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

    // Lista de espacios únicos para el filtro
    const espaciosDisponibles = Array.from(
        new Set(posters.map(p => p.nombre_espacio).filter(Boolean))
    );

    // Filtrado dinámico
    const postersFiltrados = posters.filter(p => {
        const coincideTexto = `${p.titulo} ${p.autores} ${p.categoria} ${p.nombre_espacio || ''}`
            .toLowerCase()
            .includes(filtroTexto.toLowerCase());

        const coincideEspacio = filtroEspacio === "TODOS"
            ? true
            : filtroEspacio === "SIN_ESPACIO"
                ? !p.nombre_espacio
                : p.nombre_espacio === filtroEspacio;

        return coincideTexto && coincideEspacio;
    });

    // Función para imprimir listado / reporte de ubicación
    const imprimirReporteUbicacion = () => {
        window.print();
    };

    return (
        <section className="todos-posters area-impresion">
            <h2>Gestión e Inventario de Pósters (Administración)</h2>

            {/* BARRA DE FILTROS Y REPORTE */}
            <div className="filtros-admin" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Buscar por título, autor o categoría..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="input-filtro"
                    style={{ flex: '1', minWidth: '200px' }}
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
                    onClick={imprimirReporteUbicacion}
                    style={{ padding: '10px 15px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <FaPrint /> Imprimir Listado
                </button>
            </div>

            {/* TABLA DE PÓSTERS */}
            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Autores</th>
                            <th>Categoría</th>
                            <th>Espacio Físico (Ubicación)</th>
                            <th>Imagen</th>
                            <th className="no-imprimir">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                                    Cargando inventario...
                                </td>
                            </tr>
                        ) : postersFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                                    No se encontraron pósters con los filtros seleccionados.
                                </td>
                            </tr>
                        ) : (
                            postersFiltrados.map(poster => (
                                <tr key={poster.id}>
                                    <td><strong>{poster.titulo}</strong></td>
                                    <td>{poster.autores}</td>
                                    <td><span className="badge-categoria">{poster.categoria}</span></td>

                                    {/* Celda de Espacio Físico */}
                                    <td>
                                        {poster.nombre_espacio ? (
                                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                                                🏛️ {poster.nombre_espacio}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#dc3545', italic: 'true' }}>
                                                ❌ Sin Asignar
                                            </span>
                                        )}
                                    </td>

                                    <td>
                                        {poster.imagen ? (
                                            <img
                                                src={construirUrlArchivo(poster.imagen)}
                                                alt={poster.titulo}
                                                className="img-miniatura"
                                                onClick={() => setImagenSeleccionada(construirUrlArchivo(poster.imagen))}
                                                style={{ cursor: "pointer", width: '50px', height: '50px', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <span>Sin archivo</span>
                                        )}
                                    </td>

                                    {/* Acciones para Administración */}
                                    <td className="no-imprimir">
                                        <button
                                            className="btn-accion-tabla"
                                            onClick={() => setPosterAEspacio(poster)}
                                            title="Asignar o Cambiar Ubicación Física"
                                            style={{ background: '#0056b3', color: '#fff', marginRight: '5px' }}
                                        >
                                            <FaMapMarkerAlt /> Ubicación
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal para Asignar Espacio Físico */}
            {posterAEspacio && (
                <AsignarEspacioModal
                    poster={posterAEspacio}
                    cerrarModal={() => setPosterAEspacio(null)}
                    alActualizar={cargarPosters}
                />
            )}
        </section>
    );
};

export default MostrarPostersAdmin;