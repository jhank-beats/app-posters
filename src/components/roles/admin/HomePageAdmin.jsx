import React, { useEffect, useState } from 'react';
import HeaderAdmin from "./HeaderAdmin.jsx";
import SolicitudesUsuarios from '../generales/SolicitudesUsuarios.jsx';
import MostrarPosters from '../generales/MostrarPosters.jsx';
import MostrarPostersAdmin from '../generales/MostrarPostersAdmin.jsx';
import Usuarios from '../generales/Usuarios.jsx';
import Categorias from '../generales/Categorias.jsx';
import Cuenta from '../generales/Cuenta.jsx';
import GestionEspaciosModal from '../generales/GestionEspaciosModal.jsx';
import GestionRondas from '../generales/GestionRondas.jsx';
import GestionRecordatorios from '../generales/GestionRecordatorios.jsx';
import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import { tituloRonda } from '../generales/rondasUtils.js';
import { obtenerRondasResumen } from '../../../api/rondasResumen.js';
import "../generales/roles.css";
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';


const HomePageAdmin = () => {
    const [mostrarSolicitudes, setMostrarSolicitudes] = useState(false);
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
    const [mostrarCategorias, setMostrarCategorias] = useState(false);
    const [mostrarCuenta, setMostrarCuenta] = useState(false);

    // Estados para la Gestión de Espacios Físicos
    const [mostrarGestionEspacios, setMostrarGestionEspacios] = useState(false);
    const [espaciosResumen, setEspaciosResumen] = useState([]);

    // Estados para Rondas y Premios (admin y super admin hacen lo mismo)
    const [mostrarRondas, setMostrarRondas] = useState(false);
    const [rondasResumen, setRondasResumen] = useState([]);
    const [rondaFoco, setRondaFoco] = useState(null);

    // Estados para Recordatorios Programados (Fase 5)
    const [mostrarRecordatorios, setMostrarRecordatorios] = useState(false);
    const [recRefreshKey, setRecRefreshKey] = useState(0);

    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idRolActual, setIdRolActual] = useState(null);

    const cargarEspaciosResumen = async () => {
        try {
            const res = await fetch(`${API_BASE}/Espacios.php`);
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setEspaciosResumen(data.data || []);
            }
        } catch (error) {
            console.error("Error al cargar espacios físicos:", error);
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

    const [nombreEventoAsignado, setNombreEventoAsignado] = useState(
        () => localStorage.getItem("nombreEventoAdmin") || ""
    );

    useEffect(() => {
        const nombre = localStorage.getItem("nombreUsuario");
        if (nombre) {
            setNombreUsuario(nombre);
        }
        const idRol = localStorage.getItem("id_rol");
        if (idRol) setIdRolActual(parseInt(idRol));

        cargarEspaciosResumen();
        cargarRondasResumen();
    }, []);

    useEffect(() => {
        if (rondasResumen.length > 0 && rondasResumen[0]?.nombre_evento) {
            setNombreEventoAsignado(rondasResumen[0].nombre_evento);
            localStorage.setItem("nombreEventoAdmin", rondasResumen[0].nombre_evento);
            if (rondasResumen[0].id_evento) {
                localStorage.setItem("idEventoAdmin", String(rondasResumen[0].id_evento));
            }
        }
    }, [rondasResumen]);

    const limite = 3;

    // Las tarjetas de acciones llevan al apartado correspondiente.
    // scrollIntoView respeta el scroll-margin-top del header sticky.
    const irASeccion = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                    {nombreEventoAsignado && (
                        <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                            <span className="badge-evento" style={{ fontSize: '0.95rem', padding: '6px 14px' }}>
                                <span className="badge-evento-icono" aria-hidden="true">🗓️</span>
                                <span className="badge-evento-texto">
                                    Evento a cargo: <strong>{nombreEventoAsignado}</strong>
                                </span>
                            </span>
                        </div>
                    )}
                    <p>
                        Estás en el panel de administración de tu evento asignado (pósters, espacios físicos, rondas y recordatorios filtrados automáticamente por tu evento).
                    </p>
                </div>
                <div className="texto-tarjetas">
                    <h3>🔔 Recuerda que puedes hacer las siguientes acciones:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta" onClick={() => irASeccion('usuarios')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('usuarios')}>
                            <div className="icono">👥</div>
                            <h3>Gestionar Usuarios / Asignar Roles</h3>
                            <p>Aprobar o rechazar solicitudes y modificar roles</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('posters')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('posters')}>
                            <div className="icono">🖼️</div>
                            <h3>Administrar Pósters</h3>
                            <p>Revisar, editar o eliminar</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('espacios')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('espacios')}>
                            <div className="icono">📍</div>
                            <h3>Espacios Físicos</h3>
                            <p>Definir salones, estantes y capacidad de ubicación</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('categorias')} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('categorias')}>
                            <div className="icono">📊</div>
                            <h3>Modificar Categorías</h3>
                            <p>Cambiar, agregar o eliminar categorías de los pósters</p>
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
                {!mostrarPosters && (
                    <MostrarPosters
                        limite={limite}
                        verMas={() => setMostrarPosters(true)}
                    />
                )}
            </section>
            {mostrarPosters && (
                <div className="modal-posters">
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
                </div>
            )}

            {/* Gestión de Espacios Físicos (Resumen en Home) */}
            <section id="espacios">
                <span className="seccion-eyebrow">Ubicaciones</span>
                <h2>Gestión de Espacios Físicos y Capacidad</h2>
                <div className="contenedor-tabla">
                  <HintScrollTabla />
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

            {/* Rondas y Premios */}
            <section id="rondas">
                <span className="seccion-eyebrow">Rondas y premios</span>
                <h2>Rondas de Evaluación y Premios</h2>
                <div className="contenedor-tabla">
                  <HintScrollTabla />
                    <table>
                        <thead>
                            <tr>
                                <th>Evento</th>
                                <th>Ronda</th>
                                <th>Estado</th>
                                <th>Premios</th>
                                <th>Ganadores</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rondasResumen.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center' }}>
                                        No se encontraron rondas registradas.
                                    </td>
                                </tr>
                            ) : (
                                rondasResumen.map((ev) => (
                                    (ev.rondas || []).map((ronda) => (
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

export default HomePageAdmin;