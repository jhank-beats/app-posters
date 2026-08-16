import React, { useEffect, useState } from 'react';
import HeaderAdmin from "./HeaderAdmin.jsx";
import SolicitudesUsuarios from '../generales/SolicitudesUsuarios.jsx';
import MostrarPostersAdmin from '../generales/MostrarPostersAdmin.jsx';
import Usuarios from '../generales/Usuarios.jsx';
import Categorias from '../generales/Categorias.jsx';
import Cuenta from '../generales/Cuenta.jsx';
import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import "../generales/roles.css";

const HomePageAdmin = () => {
    const [mostrarSolicitudes, setMostrarSolicitudes] = useState(false);
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
    const [mostrarCategorias, setMostrarCategorias] = useState(false);
    const [mostrarCuenta, setMostrarCuenta] = useState(false);
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idRolActual, setIdRolActual] = useState(null);

    useEffect(() => {
        const nombre = localStorage.getItem("nombreUsuario");
        if (nombre) {
            setNombreUsuario(nombre);
        }

        const idRol = localStorage.getItem("id_rol");
        if (idRol) setIdRolActual(parseInt(idRol));
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
                    <h3>Recuerda que puedes hacer las siguientes acciones:</h3>
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
                        <Usuarios
                            cerrarTabla={() => setMostrarUsuarios(false)}
                            idRolActual={idRolActual}
                        />
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

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default HomePageAdmin;