import React, { useEffect, useState } from 'react';
import HeaderAdmin from "./HeaderAdmin.jsx";
import SolicitudesUsuarios from '../generales/SolicitudesUsuarios.jsx';
import MostrarPosters from '../generales/MostrarPosters.jsx';
import MostrarPostersAdmin from '../generales/MostrarPostersAdmin.jsx';
import Usuarios from '../generales/Usuarios.jsx';
import Categorias from '../generales/Categorias.jsx';
import Cuenta from '../generales/Cuenta.jsx';
import GestionEspaciosModal from '../generales/GestionEspaciosModal.jsx';
import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import "../generales/roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const HomePageAdmin = () => {
    const [mostrarSolicitudes, setMostrarSolicitudes] = useState(false);
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
    const [mostrarCategorias, setMostrarCategorias] = useState(false);
    const [mostrarCuenta, setMostrarCuenta] = useState(false);

    // Estados para la Gestión de Espacios Físicos
    const [mostrarGestionEspacios, setMostrarGestionEspacios] = useState(false);
    const [espaciosResumen, setEspaciosResumen] = useState([]);

    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idRolActual, setIdRolActual] = useState(null);

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

    useEffect(() => {
        const nombre = localStorage.getItem("nombreUsuario");
        if (nombre) {
            setNombreUsuario(nombre);
        }
        const idRol = localStorage.getItem("id_rol");
        if (idRol) setIdRolActual(parseInt(idRol));

        cargarEspaciosResumen();
    }, []);

    const limite = 3;

    return (
        <div className="contenedor-pagina">
            <VolverArriba />
            <HeaderAdmin abrirCuenta={() => setMostrarCuenta(true)} />

            {/* Inicio */}
            <section id="inicio" className="inicio">
                <div className="texto-inicio">
                    <h1>
                        Bienvenido Admin <br />
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
                            <div className="icono">📍</div>
                            <h3>Espacios Físicos</h3>
                            <p>Definir salones, estantes y capacidad de ubicación</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📊</div>
                            <h3>Modificar Categorías</h3>
                            <p>Cambiar, agregar o eliminar categorías de los pósters</p>
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
            <section id="pendientes">
                <span className="seccion-eyebrow">Solicitudes</span>
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
            <section id="posters">
                <span className="seccion-eyebrow">Contenido</span>
                <h2>Posters Publicados</h2>
                <MostrarPosters
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

            {/* Gestión de Espacios Físicos (Resumen en Home) */}
            <section id="espacios">
                <span className="seccion-eyebrow">Ubicaciones</span>
                <h2>Gestión de Espacios Físicos y Capacidad</h2>
                <div className="contenedor-tabla">
                    <table>
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
                                                    <span className="badge-rol" style={{ background: 'rgba(211,47,47,0.1)', color: '#c62828', padding: '4px 8px', borderRadius: '999px' }}>LLENO</span>
                                                ) : (
                                                    <span className="badge-rol rol-2">DISPONIBLE</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <button className="boton-primario" onClick={() => setMostrarGestionEspacios(true)}>
                            Administrar / Crear Espacios Físicos
                        </button>
                    </div>
                </div>
            </section>

            {/* Modal Gestión de Espacios Físicos */}
            {mostrarGestionEspacios && (
                <GestionEspaciosModal
                    cerrarModal={() => {
                        setMostrarGestionEspacios(false);
                        cargarEspaciosResumen();
                    }}
                />
            )}

            {/* Usuarios */}
            <section id="usuarios">
                <span className="seccion-eyebrow">Comunidad</span>
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
                        <Usuarios
                            cerrarTabla={() => setMostrarUsuarios(false)}
                            idRolActual={idRolActual}
                        />
                    </div>
                </div>
            )}

            {/* Categorías */}
            <section id="categorias">
                <span className="seccion-eyebrow">Clasificación</span>
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

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default HomePageAdmin;