import React, { useEffect, useState } from 'react';
import HeaderUsuario from "./HeaderUsuario.jsx";
import MostrarPosters from '../generales/MostrarPosters.jsx';
import CargarPosters from '../../formularios/CargarPosters.jsx';
import Cuenta from '../generales/Cuenta.jsx';


import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import { API_BASE } from '../../../config.js';

import "../generales/roles.css";

const HomePageUsuario = () => {
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarCargarPosters, setMostrarCargarPosters] = useState(false);
    // Clave que, al incrementarse, fuerza el refresco del listado de posters
    const [claveRecargaPosters, setClaveRecargaPosters] = useState(0);
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [mostrarCuenta, setMostrarCuenta] = useState(false);
    const [porCarreraPub, setPorCarreraPub] = useState({ sistemas: null, civil: null });

    const carreraUsuario = (localStorage.getItem("carreraUsuario") || "").toLowerCase().includes("civil")
        ? "civil"
        : "sistemas";

    const cargarEstadoPublicacion = async () => {
        try {
            const res = await fetch(`${API_BASE}/Eventos.php?activo=1`);
            const json = await res.json();
            if ((json.status === 'success' || json.success) && json.por_carrera) {
                setPorCarreraPub(json.por_carrera);
            }
        } catch (err) {
            console.error("Error al consultar estado de publicación:", err);
        }
    };

    {/*guardar nombre completo en local storage */}
    useEffect(() => {
        const nombreCompleto = localStorage.getItem("nombreUsuario");
        if (nombreCompleto) {
            setNombreUsuario(nombreCompleto);
        }
        cargarEstadoPublicacion();
    }, []);

    const estadoMiCarrera = porCarreraPub[carreraUsuario]?.estado_publicacion || null;
    const otraCarreraKey = carreraUsuario === 'civil' ? 'sistemas' : 'civil';
    const estadoOtraCarrera = porCarreraPub[otraCarreraKey]?.estado_publicacion || null;
    const miCarreraCerrada = Boolean(estadoMiCarrera && !estadoMiCarrera.abierta);
    const todasCerradas = Boolean(
        miCarreraCerrada && (!estadoOtraCarrera || !estadoOtraCarrera.abierta)
    );

    const intentarAbrirCargarPoster = () => {
        if (miCarreraCerrada) {
            if (todasCerradas) {
                window.alert('🔒 ' + (estadoMiCarrera?.mensaje || 'En este momento la subida de pósters se encuentra deshabilitada.'));
                return;
            }
            const continuar = window.confirm(
                `🔒 ${estadoMiCarrera?.mensaje || 'La publicación está cerrada para tu carrera.'}\n\nSin embargo, la otra carrera tiene publicación abierta. ¿Deseas abrir el formulario para publicar en la otra carrera?`
            );
            if (continuar) {
                setMostrarCargarPosters(true);
            }
            return;
        }
        setMostrarCargarPosters(true);
    };

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
                    {estadoMiCarrera && (
                        <div
                            style={{
                                margin: '0.75rem 0',
                                padding: '0.65rem 1rem',
                                borderRadius: '10px',
                                background: miCarreraCerrada ? 'rgba(198, 40, 40, 0.14)' : 'rgba(46, 125, 50, 0.14)',
                                border: `1px solid ${miCarreraCerrada ? 'rgba(198, 40, 40, 0.35)' : 'rgba(46, 125, 50, 0.35)'}`,
                                color: '#132740',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                maxWidth: '520px',
                            }}
                        >
                            {miCarreraCerrada ? '🔒 ' : '🟢 '}
                            {estadoMiCarrera.mensaje}
                        </div>
                    )}
                    <button 
                        className="btn-cargar-posters boton-primario"
                        onClick={intentarAbrirCargarPoster}
                        style={miCarreraCerrada ? { background: '#64748b' } : undefined}
                    >
                        {miCarreraCerrada ? '🔒 Cargar Póster (Cerrado)' : 'Cargar Póster'}
                    </button>
                </div>

                <div className="texto-tarjetas">
                    <h3>🔔 Recuerda que puedes hacer las siguientes acciones:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta" onClick={intentarAbrirCargarPoster} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && intentarAbrirCargarPoster()}>
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
                        <div className="tarjeta" onClick={intentarAbrirCargarPoster} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && intentarAbrirCargarPoster()}>
                            <div className="icono">📊</div>
                            <h3>Completa el formulario</h3>
                            <p>Recuerda llenar todo el formulario</p>
                        </div>
                        <div className="tarjeta" onClick={intentarAbrirCargarPoster} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && intentarAbrirCargarPoster()}>
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