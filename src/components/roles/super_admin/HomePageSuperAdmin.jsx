import React, { useEffect, useState } from 'react';
import HeaderSuperAdmin from "./HeaderSuperAdmin.jsx";
import SolicitudesUsuarios from '../generales/SolicitudesUsuarios.jsx';
import MostrarPostersAdmin from '../generales/MostrarPostersAdmin.jsx';
import Usuarios from '../generales/Usuarios.jsx';
import Categorias from '../generales/Categorias.jsx';
import Cuenta from '../generales/Cuenta.jsx';
import GestionEventosModal from './GestionEventosModal.jsx';
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

    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idRolActual, setIdRolActual] = useState(null);

    // Detección automática de la ruta del backend
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
            if (data.status === 'success') {
                setEventosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al obtener eventos:", error);
        } finally {
            setLoadingEventos(false);
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
                            <h3>Gestionar Usuarios / Asignar Roles</h3>
                            <p>Aprobar o rechazar solicitudes y modificar roles</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">🖼️</div>
                            <h3>Administrar Pósters</h3>
                            <p>Revisar, editar o eliminar</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📊</div>
                            <h3>Modificar Categorías</h3>
                            <p>Cambiar, agregar o eliminar categorías de los pósters</p>
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
                <div className="modal-cuenta">
                    <div className="modal">
                        <Cuenta cerrarCuenta={() => setMostrarCuenta(false)} />
                    </div>
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
                <div className="modal-solicitudes">
                    <div className="modal">
                        <SolicitudesUsuarios cerrarTabla={() => setMostrarSolicitudes(false)} />
                    </div>
                </div>
            )}

            {/* Posters publicados */}
            <section id="posters" className="posters-publicados">
                <h2>Posters Publicados</h2>
                <MostrarPostersAdmin
                    limite={limite}
                    verMas={() => setMostrarPosters(true)}
                />
            </section>
            {mostrarPosters && (
                <div className="modal-posters">
                    <div className="modal">
                        <MostrarPostersAdmin cerrarTabla={() => setMostrarPosters(false)} />
                    </div>
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
                <div className="modal-usuarios">
                    <div className="modal">
                        <Usuarios cerrarTabla={() => setMostrarUsuarios(false)} />
                    </div>
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
                <div className="modal-categorias">
                    <div className="modal">
                        <Categorias cerrarTabla={() => setMostrarCategorias(false)} />
                    </div>
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