import React, { useEffect, useState } from 'react';
import HeaderSuperAdmin from "./HeaderSuperAdmin.jsx";
import SolicitudesUsuarios from '../generales/SolicitudesUsuarios.jsx';
import MostrarPosters from '../generales/MostrarPosters.jsx';
import MostrarPostersAdmin from '../generales/MostrarPostersAdmin.jsx';
import Usuarios from '../generales/Usuarios.jsx';
import Categorias from '../generales/Categorias.jsx';
import Cuenta from '../generales/Cuenta.jsx';
import GestionEventosModal from './GestionEventosModal.jsx';
import GestionEspaciosModal from '../generales/GestionEspaciosModal.jsx';
import GestionCriterios from './GestionCriterios.jsx';
import GestionRondas from '../generales/GestionRondas.jsx';
import GestionRecordatorios from '../generales/GestionRecordatorios.jsx';
import ListadoUbicaciones from '../generales/ListadoUbicaciones.jsx';
import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import { tituloRonda } from '../generales/rondasUtils.js';
import { obtenerRondasResumen } from '../../../api/rondasResumen.js';
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

    // Estados para la Gestión de Espacios Físicos
    const [mostrarGestionEspacios, setMostrarGestionEspacios] = useState(false);
    const [espaciosResumen, setEspaciosResumen] = useState([]);

    // Estado para el Listado Completo por Ubicaciones
    const [mostrarListadoUbicaciones, setMostrarListadoUbicaciones] = useState(false);

    // Estados para Criterios de Evaluación
    const [mostrarCriterios, setMostrarCriterios] = useState(false);
    const [criteriosResumen, setCriteriosResumen] = useState([]);

    // Estados para Rondas y Premios (§6.3: la 8ª sección del panel)
    const [mostrarRondas, setMostrarRondas] = useState(false);
    const [rondasResumen, setRondasResumen] = useState([]);
    const [rondaFoco, setRondaFoco] = useState(null);

    // Estados para Recordatorios Programados (Fase 5)
    const [mostrarRecordatorios, setMostrarRecordatorios] = useState(false);
    const [recRefreshKey, setRecRefreshKey] = useState(0);

    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idRolActual, setIdRolActual] = useState(null);

    const obtenerUrlApi = async () => {
        // Ruta correcta del backend (el PHP server sirve /api desde backend/)
        const urlApi = `${SERVER_URL}/api/Eventos.php`;
        try {
            const res = await fetch(urlApi);
            return res.ok ? urlApi : urlApi;
        } catch {
            return urlApi;
        }
    };

    const cargarEventosResumen = async () => {
        try {
            setLoadingEventos(true);
            const urlApi = await obtenerUrlApi();
            const res = await fetch(urlApi);
            if (!res.ok) throw new Error(`HTTP Error Status: ${res.status}`);

            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEventosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al obtener eventos:", error);
        } finally {
            setLoadingEventos(false);
        }
    };

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

    const cargarCriteriosResumen = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/Criterios.php`);
            const data = await res.json();
            if (data.success) {
                setCriteriosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar criterios de evaluación:", error);
        }
    };

    const cargarRondasResumen = async (opts) => {
        try {
            const data = await obtenerRondasResumen(opts);
            if (data.success) {
                setRondasResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar rondas y premios:", error);
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
        cargarEspaciosResumen();
        cargarCriteriosResumen();
        cargarRondasResumen();
    }, []);

    const limite = 3;

    // Las tarjetas de acciones llevan al apartado correspondiente.
    // scrollIntoView respeta el scroll-margin-top del header sticky.
    const irASeccion = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                        Estás en el panel general del sistema de gestión de pósters (acceso completo a los eventos de Ingeniería de Sistemas e Ingeniería Civil).
                    </p>
                </div>
                <div className="texto-tarjetas">
                    <h3>🔔 Recuerda que puedes hacer las siguientes acciones:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta" onClick={() => irASeccion('usuarios')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('usuarios')}>
                            <div className="icono">👥</div>
                            <h3>Gestionar Usuarios / Roles</h3>
                            <p>Aprobar o rechazar solicitudes y modificar roles</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('criterios')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('criterios')}>
                            <div className="icono">📝</div>
                            <h3>Criterios de Evaluación</h3>
                            <p>Crear, modificar y parametrizar los criterios</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('espacios')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('espacios')}>
                            <div className="icono">📍</div>
                            <h3>Espacios Físicos</h3>
                            <p>Definir salones, estantes y capacidad de ubicación</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('eventos')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('eventos')}>
                            <div className="icono">🗓️</div>
                            <h3>Gestionar Eventos</h3>
                            <p>Crear semestres y definir el evento activo</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('recordatorios')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('recordatorios')}>
                            <div className="icono">⏰</div>
                            <h3>Recordatorios de Evaluación</h3>
                            <p>Configurar horas, personalizar el mensaje y verificar pósters pendientes</p>
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
                <div className="modal">
                    <SolicitudesUsuarios cerrarTabla={() => setMostrarSolicitudes(false)} />
                </div>
            )}

            {/* Criterios de Evaluación Dinámicos */}
            <section id="criterios">
                <span className="seccion-eyebrow">Parametrización</span>
                <h2>Criterios de Evaluación Dinámicos</h2>
                <div className="contenedor-tabla">
                    <table>
                        <thead>
                            <tr>
                                <th>Criterio</th>
                                <th>Descripción</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {criteriosResumen.length === 0 ? (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center' }}>
                                        No se encontraron criterios de evaluación registrados.
                                    </td>
                                </tr>
                            ) : (
                                criteriosResumen.slice(0, limite).map((crit) => (
                                    <tr key={crit.id}>
                                        <td><strong>{crit.nombre}</strong></td>
                                        <td>{crit.descripcion || 'Sin descripción'}</td>
                                        <td>
                                            <span className="badge-rol rol-2">ACTIVO</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <button className="boton-primario" onClick={() => setMostrarCriterios(true)}>
                            Administrar / Crear Criterios
                        </button>
                    </div>
                </div>
            </section>

            {/* Modal Gestión de Criterios */}
            {mostrarCriterios && (
                <div className="modal">
                    <GestionCriterios
                        cerrarTabla={() => {
                            setMostrarCriterios(false);
                            cargarCriteriosResumen();
                        }}
                    />
                </div>
            )}

            {/* Posters publicados */}
            <section id="posters">
                <span className="seccion-eyebrow">Contenido</span>
                <h2>Posters Publicados</h2>
                {!mostrarPosters && (
                    <MostrarPosters
                        limite={limite}
                        verMas={() => setMostrarPosters(true)}
                    />
                )}
            </section>

            {mostrarPosters && (
                <div className="modal">
                    <MostrarPostersAdmin
                        cerrarTabla={() => setMostrarPosters(false)}
                        onVerRanking={(poster) => {
                            const ultima = (poster.rondas || []).slice(-1)[0];
                            setMostrarPosters(false);
                            setRondaFoco({
                                id_evento: poster.id_evento,
                                id_ronda: poster.id_ronda || (ultima ? ultima.id_ronda : null)
                            });
                            setMostrarRondas(true);
                        }}
                    />
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
                                <th>Evento</th>
                                <th>Capacidad Máxima</th>
                                <th>Pósters Ocupados</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {espaciosResumen.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center' }}>
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
                                            <td>{esp.nombre_evento || `Evento #${esp.id_evento}`}</td>
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
                    <div className="grupo-botones-espacios">
                        <button className="boton-primario" onClick={() => setMostrarGestionEspacios(true)}>
                            Administrar / Crear Espacios Físicos
                        </button>
                        <button className="boton-secundario" onClick={() => setMostrarListadoUbicaciones(true)}>
                            📍 Ver Listado Completo por Ubicaciones
                        </button>
                    </div>
                </div>
            </section>

            {/* Modal Gestión de Espacios Físicos */}
            {mostrarGestionEspacios && (
                <div className="modal">
                    <GestionEspaciosModal
                        cerrarModal={() => {
                            setMostrarGestionEspacios(false);
                            cargarEspaciosResumen();
                        }}
                    />
                </div>
            )}

            {/* Modal para ver el Listado de Ubicaciones Completo */}
            {mostrarListadoUbicaciones && (
                <div className="modal">
                    <ListadoUbicaciones cerrarTabla={() => setMostrarListadoUbicaciones(false)} />
                </div>
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
                <div className="modal">
                    <Usuarios cerrarTabla={() => setMostrarUsuarios(false)} />
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
                <div className="modal">
                    <Categorias cerrarTabla={() => setMostrarCategorias(false)} />
                </div>
            )}

            {/* Eventos y Semestres */}
            <section id="eventos">
                <span className="seccion-eyebrow">Calendario académico</span>
                <h2>Eventos y Semestres Académicos</h2>
                {loadingEventos ? (
                    <p>Cargando lista de eventos...</p>
                ) : (
                    <div className="contenedor-tabla">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre del Evento</th>
                                    <th>Código</th>
                                    <th>Carrera</th>
                                    <th>Fechas (Inicio / Fin)</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventosResumen.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center' }}>
                                            No se encontraron eventos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    eventosResumen.slice(0, limite).map((ev) => (
                                        <tr key={ev.id_evento}>
                                            <td><strong>{ev.nombre_evento}</strong></td>
                                            <td>{ev.codigo_evento}</td>
                                            <td>
                                                <span className={`badge-rol ${ev.carrera === 'civil' ? 'rol-5' : 'rol-4'}`} style={{ textTransform: 'none' }}>
                                                    {ev.carrera === 'civil' ? '🏗️ Ing. Civil' : ev.carrera === 'ambas' ? '🤝 Ambas' : '💻 Ing. Sistemas'}
                                                </span>
                                            </td>
                                            <td>
                                                {ev.fecha_inicio ? `${ev.fecha_inicio} a ${ev.fecha_fin || 'Sin fin'}` : 'Sin definir'}
                                            </td>
                                            <td>
                                                {ev.activo == 1 ? (
                                                    <span className="badge-rol rol-2">ACTIVO</span>
                                                ) : (
                                                    <span className="badge-rol rol-1">Inactivo / Histórico</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button className="boton-primario" onClick={() => setMostrarEventos(true)}>
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
                        cerrarModal={() => {
                            setMostrarEventos(false);
                            cargarEventosResumen();
                        }}
                        cerrarTabla={() => {
                            setMostrarEventos(false);
                            cargarEventosResumen();
                        }}
                    />
                </div>
            )}

            {/* Rondas y Premios (8ª sección del panel) */}
            <section id="rondas">
                <span className="seccion-eyebrow">Rondas y premios</span>
                <h2>Rondas de Evaluación y Premios</h2>
                <div className="contenedor-tabla">
                    <table>
                        <thead>
                            <tr>
                                <th>Evento</th>
                                <th>Ronda</th>
                                <th>Estado</th>
                                <th>Cupos</th>
                                <th>Premios</th>
                                <th>Ganadores</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rondasResumen.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center' }}>
                                        No se encontraron rondas registradas.
                                    </td>
                                </tr>
                            ) : (
                                rondasResumen.map((ev) => (
                                    (ev.rondas || []).length === 0 ? (
                                        <tr key={`ev-${ev.id_evento}`}>
                                            <td>
                                                <span className="badge-evento">
                                                    <span className="badge-evento-icono" aria-hidden="true">🎓</span>
                                                    <span className="badge-evento-texto">
                                                        {ev.nombre_evento}
                                                        {ev.codigo_evento && <small>{ev.codigo_evento}</small>}
                                                    </span>
                                                </span>
                                            </td>
                                            <td colSpan="5" style={{ textAlign: 'center', color: '#5f5e5e' }}>
                                                Sin rondas configuradas
                                            </td>
                                        </tr>
                                    ) : (
                                        ev.rondas.map((ronda) => (
                                            <tr key={ronda.id_ronda}>
                                                <td>
                                                    <span className="badge-evento">
                                                        <span className="badge-evento-icono" aria-hidden="true">🎓</span>
                                                        <span className="badge-evento-texto">
                                                            {ev.nombre_evento}
                                                            {ev.codigo_evento && <small>{ev.codigo_evento}</small>}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td><strong>{tituloRonda(ronda)}</strong></td>
                                                <td>
                                                    {ronda.estado === 'abierta' ? (
                                                        <span className="badge-rol rol-2">ABIERTA</span>
                                                    ) : (
                                                        <span className="badge-rol rol-3">CERRADA</span>
                                                    )}
                                                </td>
                                                <td>{ronda.cupos_seleccion ?? 'Sin límite'}</td>
                                                <td>{ronda.premios}</td>
                                                <td>
                                                    {(ronda.ganadores || []).length === 0 ? (
                                                        <span style={{ color: '#5f5e5e', fontStyle: 'italic' }}>Por publicar</span>
                                                    ) : (
                                                        <div className="subtexto-celda">
                                                            {ronda.ganadores.map((g) => (
                                                                <div key={g.id_poster}>
                                                                    <span className="badge-premio">{g.premio || `${g.lugar}º lugar`}</span>{' '}
                                                                    {g.titulo}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )
                                ))
                            )}
                        </tbody>
                    </table>
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <button
                            className="boton-primario"
                            onClick={() => {
                                setRondaFoco(null);
                                setMostrarRondas(true);
                            }}
                        >
                            Administrar Rondas y Premios
                        </button>
                    </div>
                </div>
            </section>

            {/* Modal Gestión de Rondas y Premios */}
            {mostrarRondas && (
                <div className="modal">
                    <GestionRondas
                        cerrarTabla={() => {
                            setMostrarRondas(false);
                            setRondaFoco(null);
                            cargarRondasResumen({ refetch: true });
                        }}
                        idEventoInicial={rondaFoco ? rondaFoco.id_evento : null}
                        idRondaFoco={rondaFoco ? rondaFoco.id_ronda : null}
                    />
                </div>
            )}

            {/* Recordatorios Programados y Mensajes Personalizables */}
            <section id="recordatorios">
                <span className="seccion-eyebrow">Automatización y avisos</span>
                <h2>Recordatorios de Evaluación y Horarios</h2>
                <GestionRecordatorios
                    key={recRefreshKey}
                    modo="resumen"
                    abrirModal={() => setMostrarRecordatorios(true)}
                />
            </section>

            {/* Modal Gestión de Recordatorios */}
            {mostrarRecordatorios && (
                <div className="modal">
                    <GestionRecordatorios
                        modo="modal"
                        cerrarModal={() => {
                            setMostrarRecordatorios(false);
                            setRecRefreshKey((k) => k + 1);
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