import React, { useEffect, useState } from 'react';
import HeaderSuperAdmin from "./HeaderSuperAdmin.jsx";
import SolicitudesUsuarios from '../generales/SolicitudesUsuarios.jsx';
import MostrarPosters from '../generales/MostrarPosters.jsx';
import MostrarPostersAdmin from '../generales/MostrarPostersAdmin.jsx';
import Usuarios from '../generales/Usuarios.jsx';
import Categorias from '../generales/Categorias.jsx';
import Cuenta from '../generales/Cuenta.jsx';
import GestionEventosModal from './GestionEventosModal.jsx';
import GestionEspaciosModal from '../generales/GestionEspaciosModal.jsx';
import GestionCriterios from './GestionCriterios.jsx';
import ListadoUbicaciones from '../generales/ListadoUbicaciones.jsx';
import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import "../generales/roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const HomePageSuperAdmin = () => {
    const [mostrarSolicitudes, setMostrarSolicitudes] = useState(false);
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
    const [mostrarCategorias, setMostrarCategorias] = useState(false);
    const [mostrarCuenta, setMostrarCuenta] = useState(false);

    const [mostrarEventos, setMostrarEventos] = useState(false);
    const [eventosResumen, setEventosResumen] = useState([]);
    const [loadingEventos, setLoadingEventos] = useState(true);

    // Estados para la Gestión de Espacios Físicos
    const [mostrarGestionEspacios, setMostrarGestionEspacios] = useState(false);
    const [espaciosResumen, setEspaciosResumen] = useState([]);

    // Estado para el Listado Completo por Ubicaciones
    const [mostrarListadoUbicaciones, setMostrarListadoUbicaciones] = useState(false);

    // Estados para Criterios de Evaluación
    const [mostrarCriterios, setMostrarCriterios] = useState(false);
    const [criteriosResumen, setCriteriosResumen] = useState([]);

    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idRolActual, setIdRolActual] = useState(null);

    const obtenerUrlApi = async () => {
        try {
            const resPrincipal = await fetch(`${SERVER_URL}/backend/api/Eventos.php`);
            if (resPrincipal.ok) return `${SERVER_URL}/backend/api/Eventos.php`;
        } catch (e) { }
        return `${SERVER_URL}/api/Eventos.php`;
    };

    const cargarEventosResumen = async () => {
        try {
            setLoadingEventos(true);
            const urlApi = await obtenerUrlApi();
            const res = await fetch(urlApi);
            if (!res.ok) throw new Error(`HTTP Error Status: ${res.status}`);

            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEventosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al obtener eventos:", error);
        } finally {
            setLoadingEventos(false);
        }
    };

    const cargarEspaciosResumen = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/Espacios.php`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEspaciosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar espacios físicos:", error);
        }
    };

    const cargarCriteriosResumen = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/Criterios.php`);
            const data = await res.json();
            if (data.success) {
                setCriteriosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar criterios de evaluación:", error);
        }
    };

    useEffect(() => {
        const nombre = localStorage.getItem("nombreUsuario");
        if (nombre) {
            setNombreUsuario(nombre);
        }
        const idRol = localStorage.getItem("id_rol");
        if (idRol) setIdRolActual(parseInt(idRol));

        cargarEventosResumen();
        cargarEspaciosResumen();
        cargarCriteriosResumen();
    }, []);

    const limite = 3;

    return (
        <div className="contenedor-pagina">
            <VolverArriba />
            <HeaderSuperAdmin abrirCuenta={() => setMostrarCuenta(true)} />

            {/* Inicio */}
            <section id="inicio" className="inicio">
                <div className="texto-inicio">
                    <h1>
                        Bienvenido Super Admin <br />
                        {nombreUsuario || "usuario"}
                    </h1>
                    <p>
                        Estás en la página de inicio del sistema de gestión de pósters de la UCC.
                    </p>
                </div>
                <div className="texto-tarjetas">
                    <h3>🔔 Recuerda que puedes hacer las siguientes acciones:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta">
                            <div className="icono">👥</div>
                            <h3>Gestionar Usuarios / Roles</h3>
                            <p>Aprobar o rechazar solicitudes y modificar roles</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📝</div>
                            <h3>Criterios de Evaluación</h3>
                            <p>Crear, modificar y parametrizar los criterios</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📍</div>
                            <h3>Espacios Físicos</h3>
                            <p>Definir salones, estantes y capacidad de ubicación</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">🗓️</div>
                            <h3>Gestionar Eventos</h3>
                            <p>Crear semestres y definir el evento activo</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal Cuenta */}
            {mostrarCuenta && (
                <div className="modal">
                    <Cuenta cerrarCuenta={() => setMostrarCuenta(false)} />
                </div>
            )}

            {/* Usuarios pendientes */}
            <section id="pendientes" className="pendientes">
                <h2>Usuarios Pendientes por Aceptación</h2>
                <SolicitudesUsuarios
                    limite={limite}
                    verMas={() => setMostrarSolicitudes(true)}
                />
            </section>
            {mostrarSolicitudes && (
                <div className="modal">
                    <SolicitudesUsuarios cerrarTabla={() => setMostrarSolicitudes(false)} />
                </div>
            )}

            {/* Criterios de Evaluación Dinámicos */}
            <section id="criterios" className="eventos" style={{ marginTop: '30px' }}>
                <h2>Criterios de Evaluación Dinámicos</h2>
                <div className="tabla-contenedor">
                    <table className="tabla-general">
                        <thead>
                            <tr>
                                <th>Criterio</th>
                                <th>Descripción</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {criteriosResumen.length === 0 ? (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center' }}>
                                        No se encontraron criterios de evaluación registrados.
                                    </td>
                                </tr>
                            ) : (
                                criteriosResumen.slice(0, limite).map((crit) => (
                                    <tr key={crit.id}>
                                        <td><strong>{crit.nombre}</strong></td>
                                        <td>{crit.descripcion || 'Sin descripción'}</td>
                                        <td>
                                            <span className="badge" style={{ background: '#28a745', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>
                                                ACTIVO
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div className="contenedor-ver-mas">
                        <button className="btn-ver-mas" onClick={() => setMostrarCriterios(true)}>
                            Administrar / Crear Criterios
                        </button>
                    </div>
                </div>
            </section>

            {/* Modal Gestión de Criterios */}
            {mostrarCriterios && (
                <div className="modal">
                    <GestionCriterios
                        cerrarTabla={() => {
                            setMostrarCriterios(false);
                            cargarCriteriosResumen();
                        }}
                    />
                </div>
            )}

            {/* Posters publicados */}
            <section id="posters" className="posters-publicados">
                <h2>Posters Publicados</h2>
                <MostrarPosters
                    limite={limite}
                    verMas={() => setMostrarPosters(true)}
                />
            </section>

            {mostrarPosters && (
                <div className="modal">
                    <MostrarPostersAdmin cerrarTabla={() => setMostrarPosters(false)} />
                </div>
            )}

            {/* Gestión de Espacios Físicos (Resumen en Home) */}
            <section id="espacios" className="eventos" style={{ marginTop: '30px' }}>
                <h2>Gestión de Espacios Físicos y Capacidad</h2>
                <div className="tabla-contenedor">
                    <table className="tabla-general">
                        <thead>
                            <tr>
                                <th>Nombre del Salón / Pabellón / Estante</th>
                                <th>Capacidad Máxima</th>
                                <th>Pósters Ocupados</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {espaciosResumen.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center' }}>
                                        No se encontraron espacios físicos registrados.
                                    </td>
                                </tr>
                            ) : (
                                espaciosResumen.slice(0, limite).map((esp) => {
                                    const ocupacion = esp.ocupacion_actual !== undefined ? parseInt(esp.ocupacion_actual) : (esp.ocupados || 0);
                                    const lleno = ocupacion >= esp.capacidad;
                                    return (
                                        <tr key={esp.id_espacio}>
                                            <td><strong>{esp.nombre_espacio}</strong></td>
                                            <td>{esp.capacidad}</td>
                                            <td>{ocupacion}</td>
                                            <td>
                                                {lleno ? (
                                                    <span className="badge" style={{ background: '#dc3545', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>LLENO</span>
                                                ) : (
                                                    <span className="badge" style={{ background: '#28a745', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}>DISPONIBLE</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    <div className="contenedor-ver-mas" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button className="btn-ver-mas" onClick={() => setMostrarGestionEspacios(true)}>
                            Administrar / Crear Espacios Físicos
                        </button>
                        <button
                            className="btn-ver-mas"
                            onClick={() => setMostrarListadoUbicaciones(true)}
                            style={{ background: '#17a2b8' }}
                        >
                            📍 Ver Listado Completo por Ubicaciones
                        </button>
                    </div>
                </div>
            </section>

            {/* Modal Gestión de Espacios Físicos */}
            {mostrarGestionEspacios && (
                <div className="modal">
                    <GestionEspaciosModal
                        cerrarModal={() => {
                            setMostrarGestionEspacios(false);
                            cargarEspaciosResumen();
                        }}
                    />
                </div>
            )}

            {/* Modal para ver el Listado de Ubicaciones Completo */}
            {mostrarListadoUbicaciones && (
                <div className="modal">
                    <ListadoUbicaciones cerrarTabla={() => setMostrarListadoUbicaciones(false)} />
                </div>
            )}

            {/* Usuarios */}
            <section id="usuarios" className="usuarios">
                <h2>Gestión de Usuarios</h2>
                <Usuarios
                    limite={limite}
                    verMas={() => setMostrarUsuarios(true)}
                    idRolActual={idRolActual}
                />
            </section>
            {mostrarUsuarios && (
                <div className="modal">
                    <Usuarios cerrarTabla={() => setMostrarUsuarios(false)} />
                </div>
            )}

            {/* Categorías */}
            <section id="categorias" className="categorias">
                <h2>Categorías</h2>
                <Categorias
                    limite={limite}
                    verMas={() => setMostrarCategorias(true)}
                />
            </section>
            {mostrarCategorias && (
                <div className="modal">
                    <Categorias cerrarTabla={() => setMostrarCategorias(false)} />
                </div>
            )}

            {/* Eventos y Semestres */}
            <section id="eventos" className="eventos">
                <h2>Eventos y Semestres Académicos</h2>
                {loadingEventos ? (
                    <p>Cargando lista de eventos...</p>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla-general">
                            <thead>
                                <tr>
                                    <th>Nombre del Evento</th>
                                    <th>Código</th>
                                    <th>Fechas (Inicio / Fin)</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventosResumen.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center' }}>
                                            No se encontraron eventos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    eventosResumen.slice(0, limite).map((ev) => (
                                        <tr key={ev.id_evento}>
                                            <td><strong>{ev.nombre_evento}</strong></td>
                                            <td>{ev.codigo_evento}</td>
                                            <td>
                                                {ev.fecha_inicio ? `${ev.fecha_inicio} a ${ev.fecha_fin || 'Sin fin'}` : 'Sin definir'}
                                            </td>
                                            <td>
                                                {ev.activo == 1 ? (
                                                    <span className="badge bg-success">ACTIVO</span>
                                                ) : (
                                                    <span className="badge bg-secondary">Inactivo / Histórico</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <div className="contenedor-ver-mas">
                            <button className="btn-ver-mas" onClick={() => setMostrarEventos(true)}>
                                Administrar / Ver todos los eventos
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Modal Gestión de Eventos */}
            {mostrarEventos && (
                <div className="modal">
                    <GestionEventosModal
                        cerrarModal={() => {
                            setMostrarEventos(false);
                            cargarEventosResumen();
                        }}
                        cerrarTabla={() => {
                            setMostrarEventos(false);
                            cargarEventosResumen();
                        }}
                    />
                </div>
            )}

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default HomePageSuperAdmin;