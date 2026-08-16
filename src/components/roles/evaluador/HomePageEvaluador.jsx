import React, { useEffect, useState } from 'react';
import HeaderEvaluador from "./HeaderEvaluador.jsx";
import MostrarPosters from '../generales/MostrarPosters.jsx';
import Cuenta from '../generales/Cuenta.jsx';

import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";

import "../generales/roles.css";

const HomePageEvaluador = () => {
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarCuenta, setMostrarCuenta] = useState(false);
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idEvaluador, setIdEvaluador] = useState(null);

    useEffect(() => {
        const nombre = localStorage.getItem("nombreUsuario") || localStorage.getItem("usuario");
        const id = localStorage.getItem("idUsuario") || localStorage.getItem("id_usuario");
        if (nombre) setNombreUsuario(nombre);
        if (id) setIdEvaluador(id);
    }, []);

    const limite = 3;

    return (
        <div className="contenedor-pagina">
            <VolverArriba />

            <HeaderEvaluador abrirCuenta={() => setMostrarCuenta(true)} />

            {/* Inicio */}
            <section id="inicio" className="inicio">
                <div className="texto-inicio">
                    <h1>
                        Bienvenido Evaluador <br />
                        {nombreUsuario || "usuario"}
                    </h1>
                    <p>
                        Panel de evaluación de pósters asignados - Universidad Cooperativa de Colombia.
                    </p>
                </div>

                <div className="texto-tarjetas">
                    <h3>🔔 Acciones disponibles para tu rol:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta" onClick={() => setMostrarCuenta(true)} style={{ cursor: 'pointer' }}>
                            <div className="icono">👤</div>
                            <h3>Administrar tu cuenta</h3>
                            <p>Cambiar y modificar tus datos personales</p>
                        </div>
                        <div className="tarjeta" onClick={() => setMostrarPosters(true)} style={{ cursor: 'pointer' }}>
                            <div className="icono">⭐</div>
                            <h3>Calificar Pósters</h3>
                            <p>Evaluar los pósters asignados a tu perfil</p>
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

            {/* Pósters Asignados */}
            <section id="posters" className="posters-publicados">
                <h2>Mis Pósters Asignados para Evaluación</h2>
                {idEvaluador && (
                    <MostrarPosters
                        limite={limite}
                        verMas={() => setMostrarPosters(true)}
                        idEvaluador={idEvaluador}
                        soloAsignados={true}
                    />
                )}
            </section>

            {/* Modal con la tabla completa */}
            {mostrarPosters && (
                <div className="modal-posters">
                    <div className="modal">
                        <MostrarPosters
                            cerrarTabla={() => setMostrarPosters(false)}
                            idEvaluador={idEvaluador}
                            soloAsignados={true}
                        />
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default HomePageEvaluador;