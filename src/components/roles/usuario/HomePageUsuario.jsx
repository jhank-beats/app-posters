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
    // Clave que, al incrementarse, fuerza el refresco del listado de posters
    const [claveRecargaPosters, setClaveRecargaPosters] = useState(0);
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

    // Las tarjetas de acciones llevan al apartado o formulario correspondiente.
    const irASeccion = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                        className="btn-cargar-posters boton-primario"
                        onClick={() => setMostrarCargarPosters(true)}
                    >
                        Cargar Póster
                    </button>
                </div>

                <div className="texto-tarjetas">
                    <h3>🔔 Recuerda que puedes hacer las siguientes acciones:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta" onClick={() => setMostrarCargarPosters(true)} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setMostrarCargarPosters(true)}>
                            <div className="icono">👥</div>
                            <h3>Publicar tus posters</h3>
                            <p>Enviar tus posters realizados</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('posters')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('posters')}>
                            <div className="icono">📂</div>
                            <h3>Tus Posters Publicados</h3>
                            <p>Visualizar y editar tus pósters</p>
                        </div>
                        <div className="tarjeta" onClick={() => setMostrarCargarPosters(true)} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setMostrarCargarPosters(true)}>
                            <div className="icono">📊</div>
                            <h3>Completa el formulario</h3>
                            <p>Recuerda llenar todo el formulario</p>
                        </div>
                        <div className="tarjeta" onClick={() => setMostrarCargarPosters(true)} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setMostrarCargarPosters(true)}>
                            <div className="icono">📌</div>
                            <h3>Evita dublicados</h3>
                            <p>El sistema no permite duplicados</p>
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

            {/* Modal Cargar Posters */}
            {mostrarCargarPosters && (
                <div className="modal">
                    <CargarPosters
                        cerrarModal={() => setMostrarCargarPosters(false)}
                        onPosterUpload={() => setClaveRecargaPosters(k => k + 1)}
                    />
                </div>
            )}

            {/* Mis Posters publicados */}
            <section id="posters" className="posters-publicados">
                <h2>Mis Posters Publicados</h2>
                <p style={{ textAlign: 'center', color: '#5f5e5e', maxWidth: '760px', margin: '0 auto 1.25rem', fontSize: '0.95rem' }}>
                    Consulta el estado de tus pósters en cada ronda, notas recibidas y edita su información cuando sea necesario.
                </p>
                {!mostrarPosters && (
                    <MostrarPosters
                        limite={limite}
                        verMas={() => setMostrarPosters(true)}
                        soloMisPosters={true}
                        recargarClave={claveRecargaPosters}
                        onPosterUpdated={() => setClaveRecargaPosters(k => k + 1)}
                    />
                )}
            </section>

            {mostrarPosters && (
                <div className="modal">
                    <MostrarPosters 
                        cerrarTabla={() => setMostrarPosters(false)} 
                        soloMisPosters={true}
                        recargarClave={claveRecargaPosters}
                        onPosterUpdated={() => setClaveRecargaPosters(k => k + 1)}
                    />
                </div>
            )}

            {/*footer*/}
            <Footer />

        </div>
    );
};

export default HomePageUsuario;