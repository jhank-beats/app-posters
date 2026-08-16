import React, { useEffect, useState } from 'react';
import HeaderUsuario from "./HeaderUsuario.jsx";
import MostrarPosters from '../generales/MostrarPosters.jsx';
import CargarPosters from '../../formularios/CargarPosters.jsx';
import Cuenta from '../generales/Cuenta.jsx';


import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";

import "../generales/roles.css";

const HomePageUsuario = () => {
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarCargarPosters, setMostrarCargarPosters] = useState(false);
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [mostrarCuenta, setMostrarCuenta] = useState(false);

    {/*guardar nombre completo en local storage */}
    useEffect(() => {
        const nombreCompleto = localStorage.getItem("nombreUsuario");
        if (nombreCompleto) {
            setNombreUsuario(nombreCompleto);
        }
    }, []);

    const limite = 3;

    return (
        <div className="contenedor-pagina">
            <VolverArriba />

            <HeaderUsuario abrirCuenta={() => setMostrarCuenta(true)} />

            {/* Inicio */}
            <section id="inicio" className="inicio">
                <div className="texto-inicio">
                    <h1>
                        Bienvenido usuario <br />
                        {nombreUsuario || "usuario"}
                    </h1>
                    <p> 
                        Estás en la página de inicio del sistema de gestión de pósters de la UCC.
                    </p>
                    <button 
                        className="btn-cargar-posters"
                        onClick={() => setMostrarCargarPosters(true)}
                    >
                        Cargar Póster
                    </button>
                </div>

                <div className="texto-tarjetas">
                    <h3>🔔 Recuerda que puedes hacer las siguientes acciones:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta">
                            <div className="icono">👥</div>
                            <h3>Publicar tus posters</h3>
                            <p>Enviar tus posters realizados</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📂</div>
                            <h3>Visualizar tus Posters</h3>
                            <p>Ver tus posters publicados</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📊</div>
                            <h3>Completa el formulario</h3>
                            <p>Recuerda llenar todo el formulario</p>
                        </div>
                        <div className="tarjeta">
                            <div className="icono">📌</div>
                            <h3>Evita dublicados</h3>
                            <p>El sistema no permite duplicados</p>
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

            {/* Modal Cargar Posters */}
            {mostrarCargarPosters && (
                <div className="modal-cargar-posters">
                    <div className="modal">
                        <CargarPosters cerrarModal={() => setMostrarCargarPosters(false)} />
                    </div>
                </div>
            )}

            {/* Mis Posters publicados */}
            <section id="posters" className="posters-publicados">
                <h2>Mis Posters Publicados</h2>
                <MostrarPosters 
                    limite={limite} 
                    verMas={() => setMostrarPosters(true)}
                    soloMisPosters={true}
                />
            </section>

            {mostrarPosters && (
                <div className="modal-posters">
                    <div className="modal">
                        <MostrarPosters 
                            cerrarTabla={() => setMostrarPosters(false)} 
                            soloMisPosters={true}
                        />
                    </div>
                </div>
            )}

            {/*footer*/}
            <Footer />

        </div>
    );
};

export default HomePageUsuario;