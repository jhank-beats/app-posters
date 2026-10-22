import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

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
import { API_BASE } from '../../config.js';

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

const NOMBRES_ROL = {
    superadmin: 'Super Admin',
    admin: 'Administrador',
    evaluador: 'Evaluador',
    usuario: 'Usuario',
};


const HomePage = () => {
    const [mostrarRegistro, setMostrarRegistro] = useState(false);
    const [mostrarLogin, setMostrarLogin] = useState(false);
    const [, setUser] = useState(null);
    const [mostrarPreguntasFrecuentes, setMostrarPreguntasFrecuentes] = useState(false);
    const [avisoAcceso, setAvisoAcceso] = useState('');
    const [eventosActivos, setEventosActivos] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();

    // Si se llegó aquí por un acceso denegado (?acceso=denegado&rol=admin),
    // abrir el modal de login y mostrar el aviso una sola vez.
    useEffect(() => {
        if (searchParams.get('acceso') === 'denegado') {
            const rol = NOMBRES_ROL[searchParams.get('rol')] || 'este panel';
            setAvisoAcceso(`🔒 Debes iniciar sesión para acceder al panel de ${rol}.`);
            setMostrarLogin(true);
            searchParams.delete('acceso');
            searchParams.delete('rol');
            setSearchParams(searchParams, { replace: true });
        }
    }, []);

    useEffect(() => {
        fetch(`${API_BASE}/Eventos.php?activo=1`)
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d.eventos_activos) && d.eventos_activos.length > 0) {
                    setEventosActivos(d.eventos_activos);
                } else if (d.data) {
                    setEventosActivos([d.data]);
                }
            })
            .catch(() => {});
    }, []);

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
                        <span className='hero-eyebrow'>Facultad de Ingeniería · UCC</span>
                        <h1>Sistema de Gestión de Pósters</h1>

                        <p>Plataforma académica de Ingeniería de Sistemas (Comunidad GensTI) e Ingeniería Civil de la Universidad Cooperativa de Colombia para gestionar, organizar y evaluar proyectos de investigación.</p>

                        {eventosActivos.length > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    marginBottom: '1.1rem',
                                }}
                                aria-label="Eventos activos por carrera"
                            >
                                {eventosActivos.map((ev) => (
                                    <span
                                        key={ev.id_evento}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            background: 'rgba(0, 172, 201, 0.18)',
                                            border: '1px solid rgba(0, 172, 201, 0.55)',
                                            color: '#ffffff',
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span>{ev.carrera === 'civil' ? '🏗️' : ev.carrera === 'ambas' ? '🤝' : '💻'}</span>
                                        <span>
                                            <strong>{ev.carrera === 'civil' ? 'Ing. Civil:' : ev.carrera === 'ambas' ? 'General:' : 'Ing. Sistemas:'}</strong>{' '}
                                            {ev.nombre_evento}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}

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
                            alt="Estudiantes de Ingeniería de Sistemas e Ingeniería Civil presentando proyectos"
                            decoding="async"
                            fetchPriority="high"
                        />
                        <span className='hero-detalle hero-detalle-cian' aria-hidden="true"></span>
                        <span className='hero-detalle hero-detalle-verde' aria-hidden="true"></span>
                    </div>
                </div>
            </section>

            {/* apartado de comunidad académica */}
            <section id='comunidad' className='comunidad-gensti seccion-home'>
                <div className='subtitulo-texto-comunidad'>
                    <span className='seccion-eyebrow'>Nosotros</span>
                    <h2>Comunidad de Ingeniería · GensTI & Civil</h2>
                    <p>Programas de Ingeniería de Sistemas e Ingeniería Civil de la Universidad Cooperativa de Colombia.</p>
                </div>

                <div className='cuadros-texto'>
                    <CuadrosTextoComunidad
                        icono={faUsers}
                        color="#00acc9"
                        titulo="¿Qué somos?"
                        descripcion="Somos la comunidad académica de Ingeniería de Sistemas (GensTI) e Ingeniería Civil: estudiantes y docentes que comparten proyectos, conocimiento e investigación aplicada."
                    />

                    <CuadrosTextoComunidad
                        icono={faBullseye}
                        color="#80ba27"
                        titulo="Objetivos"
                        descripcion="Impulsamos la investigación, la innovación en ingeniería y el desarrollo tecnológico e infraestructura, fomentando la participación académica en cada semestre."
                    />

                    <CuadrosTextoComunidad
                        icono={faFlask}
                        color="#cad400"
                        titulo="Semilleros de Investigación"
                        descripcion="Los semilleros de Ingeniería de Sistemas e Ingeniería Civil son el espacio para desarrollar proyectos interdisciplinarios con acompañamiento docente."
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
                            loading="lazy"
                            decoding="async"
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

            {/* Aviso de acceso denegado (se descarta al cerrar) */}
            {avisoAcceso && (
                <div
                    role="alert"
                    style={{
                        position: 'fixed',
                        top: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10000,
                        background: '#132740',
                        color: '#fff',
                        borderLeft: '6px solid #cad400',
                        borderRadius: '12px',
                        padding: '0.8rem 1rem',
                        boxShadow: '0 6px 20px rgba(19,39,64,0.35)',
                        maxWidth: 'min(92vw, 560px)',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center',
                    }}
                >
                    <span style={{ flex: 1 }}>{avisoAcceso}</span>
                    <button
                        onClick={() => setAvisoAcceso('')}
                        aria-label="Cerrar aviso"
                        style={{
                            background: '#00acc9',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.3rem 0.7rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                        }}
                    >
                        X
                    </button>
                </div>
            )}

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
            {mostrarLogin && (
                <div className="modal-registro">
                    <Login
                        setUser={setUser}
                        cerrarLogin={() => setMostrarLogin(false)}
                        abrirRegistro={() => {
                            setMostrarLogin(false);
                            setMostrarRegistro(true);
                        }}
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