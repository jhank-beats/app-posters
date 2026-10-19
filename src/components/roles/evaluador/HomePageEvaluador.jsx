import React, { useEffect, useState } from 'react';
import HeaderEvaluador from "./HeaderEvaluador.jsx";
import MostrarPosters from '../generales/MostrarPosters.jsx';
import CargarPosters from '../../formularios/CargarPosters.jsx';
import Cuenta from '../generales/Cuenta.jsx';

import Footer from "../../generales/Footer.jsx";
import VolverArriba from "../../generales/VolverArriba.jsx";
import { obtenerRondasResumen } from '../../../api/rondasResumen.js';

import "../generales/roles.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const HomePageEvaluador = () => {
    const [mostrarPosters, setMostrarPosters] = useState(false);
    const [mostrarMisPosters, setMostrarMisPosters] = useState(false);
    const [mostrarCargarPosters, setMostrarCargarPosters] = useState(false);
    const [claveRecargaMisPosters, setClaveRecargaMisPosters] = useState(0);
    const [mostrarCuenta, setMostrarCuenta] = useState(false);
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [idEvaluador, setIdEvaluador] = useState(null);

    // Pestañas de ronda y contador de pendientes (§6.3)
    const [rondas, setRondas] = useState([]);
    const [idRonda, setIdRonda] = useState("");
    const [pendientes, setPendientes] = useState({});
    const [avance, setAvance] = useState({});
    const [hayVariosEventos, setHayVariosEventos] = useState(false);

    useEffect(() => {
        const nombre = localStorage.getItem("nombreUsuario") || localStorage.getItem("usuario");
        const id = localStorage.getItem("idUsuario") || localStorage.getItem("id_usuario");
        if (nombre) setNombreUsuario(nombre);
        if (id) setIdEvaluador(id);
    }, []);

    useEffect(() => {
        if (!idEvaluador) return;
        cargarRondasYPendientes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEvaluador]);

    const cargarRondasYPendientes = async () => {
        try {
            const data = await obtenerRondasResumen();
            if (!data.success) return;

            const lista = [];
            (data.data || []).forEach(ev => {
                // ev.fecha_inicio viene como dd/mm/yyyy
                const anio = (ev.fecha_inicio || '').split('/')[2] || '';
                (ev.rondas || []).forEach(r => {
                    lista.push({
                        id_ronda: r.id_ronda,
                        id_evento: ev.id_evento,
                        numero: r.numero,
                        nombre: r.nombre,
                        estado: r.estado,
                        corte_confirmado: Number(r.corte_confirmado || 0),
                        n_selecciones: r.n_selecciones ?? 0,
                        n_evaluaciones: r.n_evaluaciones ?? 0,
                        nombre_evento: ev.nombre_evento,
                        anio
                    });
                });
            });
            setRondas(lista);
            setHayVariosEventos(new Set(lista.map(r => r.id_evento)).size > 1);

            // Pendientes por ronda + avance propio (calificados de N asignados).
            const mapa = {};
            const avance = {};
            await Promise.all(lista.map(async (r) => {
                try {
                    const rp = await fetch(`${SERVER_URL}/api/TablaPosters.php?ronda=${r.id_ronda}&id_evaluador=${idEvaluador}`);
                    const dp = await rp.json();
                    const filas = dp.data || [];
                    const mias = filas.filter(p => p.calificable !== false);
                    mapa[r.id_ronda] = filas.filter(p =>
                        p.calificable !== false && parseInt(p.n_evaluaciones_ronda || 0, 10) === 0
                    ).length;
                    avance[r.id_ronda] = { total: mias.length, pendientes: mapa[r.id_ronda] };
                } catch {
                    mapa[r.id_ronda] = 0;
                    avance[r.id_ronda] = { total: 0, pendientes: 0 };
                }
            }));
            setPendientes(mapa);
            setAvance(avance);
        } catch (error) {
            console.error("Error al cargar rondas:", error);
        }
    };

    const irASeccion = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const rondaSel = rondas.find(r => String(r.id_ronda) === String(idRonda)) || null;
    const totalPendientes = rondas
        .filter(r => r.estado === 'abierta')
        .reduce((acc, r) => acc + (pendientes[r.id_ronda] || 0), 0);

    const limite = 3;

    return (
        <div className="contenedor-pagina">
            <VolverArriba />

            <HeaderEvaluador
                abrirCuenta={() => setMostrarCuenta(true)}
                abrirPublicarPoster={() => setMostrarCargarPosters(true)}
            />

            {/* Inicio */}
            <section id="inicio" className="inicio">
                <div className="texto-inicio">
                    <h1>
                        Bienvenido Evaluador <br />
                        {nombreUsuario || "usuario"}
                    </h1>
                    <p>
                        Panel de evaluación y publicación docente — Universidad Cooperativa de Colombia.
                        Aquí puedes <strong>calificar los pósters asignados</strong> en cada ronda y también <strong>publicar tus propios pósters</strong> (el sistema asigna otros evaluadores e impide la autoevaluación).
                    </p>
                    {totalPendientes > 0 && (
                        <p className="contador-pendientes">
                            ✏️ Te faltan <strong>{totalPendientes}</strong> pósters por calificar
                            {rondaSel ? ` en la ${rondaSel.nombre}` : ''}.
                        </p>
                    )}
                    <button
                        className="btn-cargar-posters"
                        onClick={() => setMostrarCargarPosters(true)}
                    >
                        Publicar Póster
                    </button>
                </div>

                <div className="texto-tarjetas">
                    <h3>🔔 Acciones disponibles para tu rol:</h3>
                    <div className="grupo-tarjetas">
                        <div className="tarjeta" onClick={() => setMostrarCuenta(true)} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setMostrarCuenta(true)}>
                            <div className="icono">👤</div>
                            <h3>Administrar tu cuenta</h3>
                            <p>Cambiar y modificar tus datos personales</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('posters')} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('posters')}>
                            <div className="icono">⭐</div>
                            <h3>Calificar Pósters</h3>
                            <p>Evaluar los pósters asignados a tu perfil</p>
                        </div>
                        <div className="tarjeta" onClick={() => setMostrarCargarPosters(true)} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setMostrarCargarPosters(true)}>
                            <div className="icono">📤</div>
                            <h3>Publicar Póster</h3>
                            <p>Subir un póster propio (evaluado por otros pares)</p>
                        </div>
                        <div className="tarjeta" onClick={() => irASeccion('mis-posters')} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && irASeccion('mis-posters')}>
                            <div className="icono">📂</div>
                            <h3>Mis Pósters Publicados</h3>
                            <p>Ver el estado, rondas y notas de tus pósters</p>
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

            {/* Modal Cargar Pósters (reutiliza el patrón de HomePageUsuario.jsx) */}
            {mostrarCargarPosters && (
                <div className="modal">
                    <CargarPosters
                        cerrarModal={() => setMostrarCargarPosters(false)}
                        onPosterUpload={() => setClaveRecargaMisPosters(k => k + 1)}
                    />
                </div>
            )}

            {/* Pósters Asignados para Evaluación */}
            <section id="posters" className="posters-publicados">
                <h2>Mis Pósters Asignados para Evaluación</h2>
                <p style={{ textAlign: 'center', color: '#5f5e5e', maxWidth: '760px', margin: '0 auto 1.25rem', fontSize: '0.95rem' }}>
                    Aquí aparecen únicamente los pósters de otros autores asignados a tu perfil en cada ronda.
                </p>

                {rondas.length > 0 && (
                    <div className="pestanas-rondas" role="tablist" aria-label="Rondas de evaluación">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={idRonda === ""}
                            className={`pestana-ronda ${idRonda === "" ? "activa" : ""}`}
                            onClick={() => setIdRonda("")}
                        >
                            Todas
                        </button>
                        {rondas.map(r => (
                            <button
                                key={r.id_ronda}
                                type="button"
                                role="tab"
                                aria-selected={String(idRonda) === String(r.id_ronda)}
                                className={`pestana-ronda ${String(idRonda) === String(r.id_ronda) ? "activa" : ""}`}
                                onClick={() => setIdRonda(String(r.id_ronda))}
                                title={`${r.nombre} · ${r.estado}${r.corte_confirmado ? ' · corte confirmado' : ''} · ${avance[r.id_ronda]?.total ?? '?'} pósters asignados`}
                            >
                                Ronda {r.numero}
                                {r.anio ? ` · ${r.anio}` : ''}
                                {hayVariosEventos && r.nombre_evento ? ` · ${r.nombre_evento}` : ''}
                                {` · ${r.estado}`}
                                {r.corte_confirmado ? ' · corte ✓' : ''}
                                {avance[r.id_ronda] ? ` · ${avance[r.id_ronda].total - avance[r.id_ronda].pendientes}/${avance[r.id_ronda].total}` : ''}
                                {(pendientes[r.id_ronda] || 0) > 0 ? ` · ${pendientes[r.id_ronda]} pendientes` : ''}
                            </button>
                        ))}
                    </div>
                )}

                {idEvaluador && !mostrarPosters && (
                    <MostrarPosters
                        limite={limite}
                        verMas={() => setMostrarPosters(true)}
                        idEvaluador={idEvaluador}
                        soloAsignados={true}
                        idRondaInicial={idRonda}
                        onRondaChange={setIdRonda}
                    />
                )}
            </section>

            {/* Modal con la tabla completa de asignados */}
            {mostrarPosters && (
                <div className="modal-posters">
                    <div className="modal">
                        <MostrarPosters
                            cerrarTabla={() => setMostrarPosters(false)}
                            idEvaluador={idEvaluador}
                            soloAsignados={true}
                            idRondaInicial={idRonda}
                            onRondaChange={setIdRonda}
                        />
                    </div>
                </div>
            )}

            {/* Mis Pósters Publicados por el propio evaluador (Fase 3) */}
            <section id="mis-posters" className="posters-publicados">
                <h2>Mis Pósters Publicados</h2>
                <p style={{ textAlign: 'center', color: '#5f5e5e', maxWidth: '760px', margin: '0 auto 1rem', fontSize: '0.95rem' }}>
                    Consulta el estado de los pósters que has publicado como autor (en espera, en evaluación, pasó de ronda, finalista o ganador). Por regla de transparencia, tus pósters son calificados por otros evaluadores.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                    <button
                        type="button"
                        className="boton-primario"
                        onClick={() => setMostrarCargarPosters(true)}
                    >
                        + Publicar nuevo póster
                    </button>
                </div>

                {!mostrarMisPosters && (
                    <MostrarPosters
                        limite={limite}
                        verMas={() => setMostrarMisPosters(true)}
                        soloMisPosters={true}
                        recargarClave={claveRecargaMisPosters}
                    />
                )}
            </section>

            {/* Modal con la tabla completa de Mis Pósters Publicados */}
            {mostrarMisPosters && (
                <div className="modal">
                    <MostrarPosters
                        cerrarTabla={() => setMostrarMisPosters(false)}
                        soloMisPosters={true}
                        recargarClave={claveRecargaMisPosters}
                    />
                </div>
            )}

            <Footer />
        </div>
    );
};

export default HomePageEvaluador;
