import React, { useState } from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers,
    faBullseye,
    faFlask,
    faCloudUploadAlt,
    faUserCheck,
    faMapMarkerAlt,
    faClipboardCheck,
    faDownload,
} from '@fortawesome/free-solid-svg-icons';

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

            {/* Contenido principal: Hero / Comunidad / Novedades / Posters.
                Cada sección conserva su id (react-scroll) y su componente;
                la clase "seccion-home" es el gancho común para el rediseño por etapas. */}
            <main className="contenido-home">
            {/* sección de inicio (Hero) */}
            <section id='inicio' className='inicio seccion-home'>
                <div className='hero-tarjeta'>
                    <div className='texto-inicio'>
                        <span className='hero-eyebrow'>Comunidad GensTI</span>
                        <h1>Sistema de Gestión de Posters</h1>

                        <p>Plataforma de la comunidad de Ingeniería de Sistemas de la Universidad Cooperativa de Colombia para gestionar, organizar y evaluar proyectos de investigación.</p>

                        <div className='botones-inicio'>
                            <button
                                className='boton-primario'
                                onClick={() => {
                                    setMostrarRegistro(true);
                                }}
                            >
                                Regístrate
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
                            src="https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=800"
                            alt="Estudiantes de Ingeniería de Sistemas desarrollando software"
                        />
                        <span className='hero-detalle hero-detalle-cian' aria-hidden="true"></span>
                        <span className='hero-detalle hero-detalle-verde' aria-hidden="true"></span>
                    </div>
                </div>
            </section>

            {/* apartado de comunidad GENSTI */}
            <section id='comunidad' className='comunidad-gensti seccion-home'>
                <div className='subtitulo-texto-comunidad'>
                    <span className='seccion-eyebrow'>Nosotros</span>
                    <h2>Comunidad GensTI</h2>
                    <p>Comunidad de la Facultad de Ingeniería de Sistemas de la Universidad Cooperativa de Colombia.</p>
                </div>

                <div className='cuadros-texto'>
                    <CuadrosTextoComunidad
                        icono={faUsers}
                        color="#00acc9"
                        titulo="¿Qué somos?"
                        descripcion="GensTI es la comunidad académica de Ingeniería de Sistemas: estudiantes y docentes que comparten proyectos, conocimiento e investigación para crecer juntos."
                    />

                    <CuadrosTextoComunidad
                        icono={faBullseye}
                        color="#80ba27"
                        titulo="Objetivos"
                        descripcion="Impulsamos la investigación, la innovación y el desarrollo tecnológico, fomentando la participación académica en cada semestre."
                    />

                    <CuadrosTextoComunidad
                        icono={faFlask}
                        color="#cad400"
                        titulo="Semilleros de Investigación"
                        descripcion="Los semilleros son el espacio para desarrollar proyectos, investigar y trabajar de forma colaborativa con acompañamiento docente."
                    />
                </div>

            </section>

            {/* sección de novedades en carrusel */}
            <section id='novedades' className='novedades seccion-home'>
                <div className='titulo-texto-novedades'>
                    <span className='seccion-eyebrow'>Actualidad</span>
                    <h2>Novedades</h2>
                    <p>Noticias recientes y más relevantes de la comunidad y la UCC.</p>
                </div>
                <div className='carrusel-separacion'>
                    <Carrusel images={images} />
                </div>
            </section>

            {/* sección de posters — proceso informativo, la Homepage es pública */}
            <section id='posters' className='posters seccion-home'>
                <div className='titulo-texto-posters'>
                    <span className='seccion-eyebrow'>Proceso</span>
                    <h2>Posters</h2>
                    <p>Conoce el proceso de gestión y evaluación de los proyectos dentro de la plataforma.</p>
                </div>

                <div className='proceso-posters'>

                    {/* Card 1 - Carga de Posters */}
                    <article className='tarjeta-proceso' style={{ '--acento-proceso': '#00acc9' }}>
                        <span className='icono-proceso' aria-hidden="true">
                            <FontAwesomeIcon icon={faCloudUploadAlt} />
                        </span>
                        <h3>Carga de Posters</h3>
                        <p>Los usuarios autorizados pueden registrar sus proyectos y cargar el material correspondiente mediante el sistema.</p>
                    </article>

                    {/* Card 2 - Asignación de Evaluadores */}
                    <article className='tarjeta-proceso' style={{ '--acento-proceso': '#80ba27' }}>
                        <span className='icono-proceso' aria-hidden="true">
                            <FontAwesomeIcon icon={faUserCheck} />
                        </span>
                        <h3>Asignación de Evaluadores</h3>
                        <p>Los administradores pueden asignar evaluadores a los proyectos registrados.</p>
                    </article>

                    {/* Card 3 - Gestión de Espacios */}
                    <article className='tarjeta-proceso' style={{ '--acento-proceso': '#132740' }}>
                        <span className='icono-proceso' aria-hidden="true">
                            <FontAwesomeIcon icon={faMapMarkerAlt} />
                        </span>
                        <h3>Gestión de Espacios</h3>
                        <p>El sistema permite organizar la asignación de espacios para la presentación de los proyectos.</p>
                    </article>

                    {/* Card 4 - Evaluación y Resultados */}
                    <article className='tarjeta-proceso' style={{ '--acento-proceso': '#cad400' }}>
                        <span className='icono-proceso' aria-hidden="true">
                            <FontAwesomeIcon icon={faClipboardCheck} />
                        </span>
                        <h3>Evaluación y Resultados</h3>
                        <p>Los evaluadores registran las valoraciones y observaciones correspondientes.</p>
                    </article>

                </div>

                <p className='aviso-proceso'>
                    🔒 El acceso a los proyectos y evaluaciones está protegido según el rol asignado dentro de la plataforma.
                </p>

                {/* Maqueta pública del semestre y recomendaciones */}
                <div className='poster-semestre'>

                    <div className='tarjeta-maqueta'>
                        <h3>Poster del Semestre</h3>
                        <img
                            className='imagen-poster'
                            src="/img/poster.png"
                            alt="Maqueta del poster para este semestre"
                        />
                        <a className='boton-descargar-poster' href="/img/poster.png" download="Maqueta-Poster.png">
                            <FontAwesomeIcon icon={faDownload} />
                            Descargar maqueta
                        </a>
                    </div>

                    <div className='tarjeta-recomendaciones'>
                        <h3>Recomendaciones para subir los posters</h3>
                        <ul>
                            <li>Evita subir posters duplicados</li>
                            <li>Respeta los derechos de autor y evita el plagio</li>
                            <li>Revisa la información antes de publicar</li>
                            <li>Respeta los lineamientos de diseño institucional</li>
                        </ul>
                    </div>
                </div>
            </section>
            </main>

            {/*Footer de las paginas  */}
            <Footer />

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