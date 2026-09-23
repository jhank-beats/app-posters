import React, { useState, useEffect } from 'react';
import { FaPrint, FaMapMarkerAlt, FaFileExcel } from "react-icons/fa";
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const ListadoUbicaciones = ({ cerrarTabla }) => {
    const [espaciosConPosters, setEspaciosConPosters] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarDatosUbicaciones();
    }, []);

    const cargarDatosUbicaciones = async () => {
        try {
            setLoading(true);
            const resEspacios = await fetch(`${SERVER_URL}/api/Espacios.php`);
            const dataEspacios = await resEspacios.json();

            const resPosters = await fetch(`${SERVER_URL}/api/TablaPosters.php`);
            const dataPosters = await resPosters.json();

            if (dataEspacios.status === 'success' && dataPosters.success) {
                const espacios = dataEspacios.data || [];
                const posters = dataPosters.data || [];

                const agrupados = espacios.map(espacio => {
                    const postersDelEspacio = posters.filter(p => p.nombre_espacio === espacio.nombre_espacio);
                    return {
                        ...espacio,
                        postersAsignados: postersDelEspacio
                    };
                });

                setEspaciosConPosters(agrupados);
            }
        } catch (error) {
            console.error("Error al cargar listado de ubicaciones:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportarExcel = () => {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        // Se eliminaron "Capacidad" y "Ocupacion" de las columnas
        csvContent += "Espacio,Puesto / N°,Titulo del Poster,Autores,Categoria,Autor / Usuario\n";

        espaciosConPosters.forEach(espacio => {
            if (espacio.postersAsignados.length === 0) {
                const fila = `"${espacio.nombre_espacio}","Sin asignar","Sin asignar","Sin asignar","Sin asignar","Sin asignar"\n`;
                csvContent += fila;
            } else {
                espacio.postersAsignados.forEach((poster, index) => {
                    const puesto = poster.ubicacion_detallada || (index + 1);
                    const titulo = `"${(poster.titulo || "").replace(/"/g, '""')}"`;
                    const autores = `"${(poster.autores || "").replace(/"/g, '""')}"`;
                    const categoria = `"${(poster.categoria || "").replace(/"/g, '""')}"`;
                    const usuario = `"${(poster.nombre_usuario || "Desconocido").replace(/"/g, '""')}"`;

                    // Se eliminaron los campos de capacidad y ocupación en la fila
                    const fila = `"${espacio.nombre_espacio}","${puesto}",${titulo},${autores},${categoria},${usuario}\n`;
                    csvContent += fila;
                });
            }
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "listado_ubicaciones_posters.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <section className="todos-posters listado-ubicaciones-ancho-total">
            {cerrarTabla && (
                <button className="cerrar-tabla" onClick={cerrarTabla}>X</button>
            )}

            <div className="listado-ubicaciones-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px', gap: '15px', textAlign: 'center' }}>
                <h2 style={{ margin: 0, width: '100%', paddingRight: cerrarTabla ? '30px' : '0' }}>Listado de Pósters Organizados por Ubicación Física</h2>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={exportarExcel}
                        style={{ padding: '8px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                    >
                        <FaFileExcel /> Descargar Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        style={{ padding: '8px 15px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                    >
                        <FaPrint /> Imprimir Listado
                    </button>
                </div>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>Generando listado de ubicaciones...</p>
            ) : espaciosConPosters.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>No hay espacios físicos registrados.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {espaciosConPosters.map((espacio) => (
                        <div key={espacio.id_espacio} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ borderBottom: '2px solid #0056b3', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                                <h3 style={{ margin: 0, color: '#0056b3', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaMapMarkerAlt /> {espacio.nombre_espacio}
                                    {espacio.ubicacion_detallada && <span style={{ fontSize: '0.8em', color: '#666' }}>({espacio.ubicacion_detallada})</span>}
                                </h3>
                                <span style={{ background: '#e2e3e5', padding: '3px 8px', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold' }}>
                                    Ocupación: {espacio.postersAsignados.length} / {espacio.capacidad}
                                </span>
                            </div>

                            {espacio.postersAsignados.length === 0 ? (
                                <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9em', margin: '5px 0' }}>No hay pósters asignados en este espacio todavía.</p>
                            ) : (
                                <div className="contenedor-tabla">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', minWidth: '600px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8f9fa', textAlign: 'left', fontSize: '0.85em' }}>
                                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '10%' }}>Puesto / N°</th>
                                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '35%' }}>Título del Póster</th>
                                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '20%' }}>Autores</th>
                                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '15%' }}>Categoría</th>
                                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd', width: '20%' }}>Autor / Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {espacio.postersAsignados.map((poster, index) => (
                                                <tr key={poster.id} style={{ fontSize: '0.9em', borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#2e7d32' }}>
                                                        #{poster.ubicacion_detallada || (index + 1)}
                                                    </td>
                                                    <td style={{ padding: '8px', fontWeight: '500', wordBreak: 'break-word' }}>{poster.titulo}</td>
                                                    <td style={{ padding: '8px', wordBreak: 'break-word' }}>{poster.autores}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span className="badge-categoria">{poster.categoria}</span>
                                                    </td>
                                                    <td style={{ padding: '8px', wordBreak: 'break-word' }}>{poster.nombre_usuario || 'Desconocido'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default ListadoUbicaciones;