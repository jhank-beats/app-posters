import React, { useState, useEffect, useRef } from 'react';
import { FaPrint, FaMapMarkerAlt, FaFileExcel } from "react-icons/fa";
import "./roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const ListadoUbicaciones = ({ cerrarTabla }) => {
    const [espaciosConPosters, setEspaciosConPosters] = useState([]);
    const [loading, setLoading] = useState(true);
    const listadoRef = useRef(null);

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
                const espaciosRaw = dataEspacios.data || [];
                const posters = dataPosters.data || [];
                // Deduplicar espacios por id_espacio
                const espaciosMap = new Map();
                espaciosRaw.forEach(e => {
                    if (!espaciosMap.has(String(e.id_espacio))) espaciosMap.set(String(e.id_espacio), e);
                });
                const espacios = Array.from(espaciosMap.values());
                const nombresEspacios = new Set(espacios.map(e => e.nombre_espacio));
                const agrupados = espacios.map(espacio => {
                    const postersDelEspacio = posters.filter(p => p.nombre_espacio === espacio.nombre_espacio);
                    return { ...espacio, postersAsignados: postersDelEspacio };
                });
                // Posters sin ubicación o con ubicación no existente
                const sinUbicacion = posters.filter(p => !p.nombre_espacio || !nombresEspacios.has(p.nombre_espacio));
                if (sinUbicacion.length > 0) {
                    agrupados.push({
                        id_espacio: 'sin-ubicacion',
                        nombre_espacio: 'Sin ubicación asignada',
                        capacidad: '-',
                        postersAsignados: sinUbicacion
                    });
                }
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

    const imprimirListado = () => {
        const contenido = listadoRef.current?.innerHTML;
        if (!contenido) { window.print(); return; }
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { window.print(); return; }
        win.document.write(`
            <html>
            <head>
                <title>Listado de Pósters por Ubicación</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: system-ui, -apple-system, sans-serif; color: #132740; margin: 0; padding: 2rem; background: #fff; }
                    h2 { color: #132740; text-align: center; margin: 0 0 0.5rem; }
                    .sub { text-align:center; color:#5f5e5e; margin-bottom:1.5rem; }
                    .tarjeta { border:1px solid rgba(19,39,64,0.08); border-top:4px solid #00acc9; border-radius:16px; padding:1.25rem; margin-bottom:1.25rem; break-inside: avoid; page-break-inside: avoid; }
                    .tarjeta h3 { margin:0; color:#132740; font-size:1rem; display:flex; align-items:center; gap:0.5rem; }
                    .badge { background:#f5f7f8; padding:4px 10px; border-radius:999px; font-size:0.8rem; font-weight:700; }
                    table { width:100%; border-collapse:collapse; margin-top:0.75rem; }
                    thead th { background:#132740; color:#fff; padding:0.6rem 0.8rem; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.06em; text-align:left; }
                    tbody td { padding:0.6rem 0.8rem; font-size:0.85rem; border-bottom:1px solid #eef2f5; }
                    .badge-rol { background: rgba(128,186,39,0.1); color:#3a6b0a; padding:3px 8px; border-radius:999px; font-size:0.75rem; font-weight:700; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display:none !important; }
                    }
                </style>
            </head>
            <body>
                <h2>Listado de Pósters Organizados por Ubicación Física</h2>
                <p class="sub">Universidad Cooperativa de Colombia — GensTI</p>
                ${contenido}
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 300);
    };

    return (
        <section className="todos-posters listado-ubicaciones-print">
            {cerrarTabla && (<button className="cerrar-tabla no-print" onClick={cerrarTabla} aria-label="Cerrar">X</button>)}
            <span className="seccion-eyebrow">Distribución física</span>
            <h2>Listado de Pósters por Ubicación Física</h2>
            <p style={{ color: '#5f5e5e', textAlign: 'center', margin: '0.5rem 0 1.5rem' }}>Consulta ocupación por salón y exporta el listado</p>

            <div className="no-print" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <button onClick={exportarExcel} className="boton-primario" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><FaFileExcel /> Descargar Excel</button>
                <button onClick={imprimirListado} className="boton-secundario" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><FaPrint /> Imprimir Listado</button>
            </div>

            <div ref={listadoRef}>
            {loading ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>Generando listado de ubicaciones...</p>
            ) : espaciosConPosters.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>No hay espacios físicos registrados.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {espaciosConPosters.map((espacio) => (
                        <div key={espacio.id_espacio} className="tarjeta" style={{ textAlign: 'left', padding: '1.5rem', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(19,39,64,0.08)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <h3 style={{ margin: 0, color: '#132740', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}><FaMapMarkerAlt style={{ color: '#00acc9' }} /> {espacio.nombre_espacio}</h3>
                                <span className="badge-rol rol-3">Ocupación: {espacio.postersAsignados.length}{espacio.capacidad !== '-' ? ` / ${espacio.capacidad}` : ''}</span>
                            </div>
                            {espacio.postersAsignados.length === 0 ? (
                                <p style={{ color: '#5f5e5e', fontStyle: 'italic' }}>No hay pósters asignados en este espacio todavía.</p>
                            ) : (
                                <div className="contenedor-tabla">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Puesto / N°</th>
                                                <th>Título del Póster</th>
                                                <th>Autores</th>
                                                <th>Categoría</th>
                                                <th>Autor / Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {espacio.postersAsignados.map((poster, index) => (
                                                <tr key={`${espacio.id_espacio}-${poster.id}-${index}`}>
                                                    <td style={{ fontWeight: 700, color: '#00acc9' }}>#{poster.ubicacion_detallada || (index + 1)}</td>
                                                    <td style={{ fontWeight: 600 }}>{poster.titulo}</td>
                                                    <td>{poster.autores}</td>
                                                    <td><span className="badge-rol rol-2">{poster.categoria}</span></td>
                                                    <td>{poster.nombre_usuario || 'Desconocido'}</td>
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
            </div>
        </section>
    );
};

export default ListadoUbicaciones;
