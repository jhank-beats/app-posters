import React, { useState } from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFacebook,
    faInstagram,
    faYoutube,
    faWhatsapp,
} from '@fortawesome/free-brands-svg-icons';

import './HomePage.css';
import Footer from "../generales/Footer.jsx";
import CuadrosTextoComunidad from './CuadrosTextoComunidad.jsx';
import Carrusel from './Carrusel.jsx';
import Header from './Header.jsx';
import VolverArriba from '../generales/VolverArriba.jsx';
import Registro from "../formularios/Registro";
import Login from "../formularios/Login";
import PreguntasFrecuentes from './PreguntasFrecuentes.jsx';

const images = [
    "https://images.pexels.com/photos/169647/pexels-photo-169647.jpeg?auto=compress&cs=tinysrgb&w=600",
    "https://images.pexels.com/photos/313782/pexels-photo-313782.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    "https://images.pexels.com/photos/773471/pexels-photo-773471.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    "https://images.pexels.com/photos/672532/pexels-photo-672532.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    "https://images.pexels.com/photos/632522/pexels-photo-632522.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
    "https://images.pexels.com/photos/777059/pexels-photo-777059.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
];

const HomePage = () => {
    const [mostrarRegistro, setMostrarRegistro] = useState(false);
    const [mostrarLogin, setMostrarLogin] = useState(false); // 👈 2. ESTADO PARA LOGIN
    const [user, setUser] = useState(null);
    const [mostrarPreguntasFrecuentes, setMostrarPreguntasFrecuentes] = useState(false);

    return (
        <div className='contenedor-pagina'>
            <VolverArriba />
            {/* encabezado de la página */}
            <Header />

            {/* sección de inicio */}
            <section id='inicio' className='inicio'>
                <div className='texto-inicio'>
                    <h1>Sistema de Gestión de Posters - Comunidad GensTI</h1>

                    <p>Plataforma de la comunidad de Ingeniería de Sistemas de la Universidad Cooperativa de Colombia para compartir, organizar y evaluar los posters de los proyectos de investigación.</p>

                    <div className='botones-inicio'>
                        <button
                            onClick={() => {
                                setMostrarRegistro(true);
                            }}
                        >
                            Registrate
                        </button>

                        <button
                            className='boton-preguntas-frecuentes'
                            onClick={() => {
                                setMostrarPreguntasFrecuentes(true);
                            }}

                        >
                            Preguntas Frecuentes
                        </button>
                    </div>
                </div>

                <div className='imagen-inicio'>
                    <img
                        src="https://placehold.jp/575x450.png"
                        alt="Imagen de Posters"
                    />
                </div>

                <div className='imagenes-redes'>
                    <FontAwesomeIcon className='cuadros' icon={faFacebook} style={{ color: '#5f5e5e' }} />
                    <FontAwesomeIcon className='cuadros' icon={faInstagram} style={{ color: '#5f5e5e' }} />
                    <FontAwesomeIcon className='cuadros' icon={faWhatsapp} style={{ color: '#5f5e5e' }} />
                    <FontAwesomeIcon className='cuadros' icon={faYoutube} style={{ color: '#5f5e5e' }} />
                </div>
            </section>

            {/* apartado de comunidad GENSTI */}
            <section id='comunidad' className='comunidad-gensti'>
                <div className='subtitulo-texto-comunidad'>
                    <h2>Comunidad GENSTI</h2>
                    <p>Comunidad de la facultad de Ingeniería de Sistemas de la Universidad Cooperativa de Colombia.</p>
                </div>

                <div className='cuadros-texto'>
                    <CuadrosTextoComunidad
                        imagen="https://placehold.jp/80ba27/ffffff/120x120.png"
                        titulo="¿Qué somos?"
                        descripcion="Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book"
                    />

                    <CuadrosTextoComunidad
                        imagen="https://placehold.jp/cad400/ffffff/120x120.png"
                        titulo="Objetivos"
                        descripcion="Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book"
                    />

                    <CuadrosTextoComunidad
                        imagen="https://placehold.jp/00acc9/ffffff/120x120.png"
                        titulo="Semilleros De Investigación"
                        descripcion="Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book"
                    />
                </div>

            </section>

            {/* sección de novedades en carrusel */}
            <section id='novedades' className='novedades'>
                <div className='titulo-texto-novedades'>
                    <h2>Novedades</h2>
                    <p>Noticias recientes y más relevantes de la comunidad y la UCC</p>
                </div>
                <div className='carrusel-separacion'>
                    <Carrusel images={images} />
                </div>
            </section>

            {/* sección de posters */}
            <section id='posters' className='posters'>
                <div className='titulo-texto-posters'>
                    <h2>Posters</h2>
                    <p>Toda la información necesaria de los posters de los proyectos de investigación</p>
                </div>

                <div className='posters-separacion'>

                    {/* Poster del semestre */}
                    <div className='poster-card'>
                        <h3>Poster del Semestre</h3>

                        <img
                            className='imagen-poster'
                            src="/img/poster.png"
                            alt="Maqueta del poster para este semestre"
                        />

                        <a
                            className='link-descarga-poster'
                            href="/img/poster.png"
                            download="Maqueta-Poster.png"
                        >
                            Descargar imagen del poster
                        </a>
                    </div>

                    {/* Recomendaciones */}
                    <div className='recomendaciones-poster'>
                        <h3>Recomendaciones para subir los posters</h3>

                        <div className='lista-recomendaciones'>
                            <p>👉 Evita subir posters duplicados</p>
                            <p>👉 Respeta los derechos de autor y evita el plagio</p>
                            <p>👉 Revisa la información antes de publicar</p>
                            <p>👉 Respeta los lineamientos de diseño institucional</p>
                        </div>
                    </div>

                </div>
            </section>

            {/*Footer de las paginas  */}
            <Footer />

            {/* Modal de registro */}
            {/* Modal de registro */}
            {mostrarRegistro && (
                <div className="modal-registro">
                    <Registro
                        setUser={setUser}
                        cerrarRegistro={() => setMostrarRegistro(false)}
                        abrirLogin={() => {
                            // 👈 3. PASAR PROPRIEDAD abrirLogin
                            setMostrarRegistro(false);
                            setMostrarLogin(true);
                        }}
                    />
                </div>
            )}

            {/* Modal de Login */}
            {mostrarLogin && ( // 👈 4. RENDERIZAR LOGIN
                <div className="modal-registro">
                    <Login
                        setUser={setUser}
                        cerrarLogin={() => setMostrarLogin(false)}
                    />
                </div>
            )}

            {mostrarPreguntasFrecuentes && (
                <div className='modal'>
                    <PreguntasFrecuentes
                        cerrar={() => setMostrarPreguntasFrecuentes(false)}
                    />
                </div>
            )}

        </div>
    );
};

export default HomePage;