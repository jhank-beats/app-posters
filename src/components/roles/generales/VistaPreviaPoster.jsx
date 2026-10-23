import React, { useEffect } from 'react';
import { FaFilePdf, FaImage } from 'react-icons/fa6';
import { FaExternalLinkAlt, FaDownload } from 'react-icons/fa';
import './roles.css';
import { urlArchivo as resolverUrlArchivo } from '../../../config.js';
import { categoriaLegible } from '../../../categorias.js';

const VistaPreviaPoster = ({ poster, cerrarModal }) => {
    const urlArchivo = resolverUrlArchivo(poster?.imagen);
    const esPdf = (poster?.imagen || '').toLowerCase().endsWith('.pdf');

    // Cerrar con Escape y evitar el scroll del fondo mientras el modal está abierto.
    useEffect(() => {
        const alPresionarEscape = (e) => { if (e.key === 'Escape') cerrarModal(); };
        document.addEventListener('keydown', alPresionarEscape);
        const overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', alPresionarEscape);
            document.body.style.overflow = overflowPrevio;
        };
    }, [cerrarModal]);

    if (!poster) return null;

    const numeroEspacio = poster.ubicacion_detallada ? `#${poster.ubicacion_detallada}` : '';

    // Cada dato del póster como bloque con etiqueta; se ocultan los que no existan.
    const datos = [
        { etiqueta: 'Autores', valor: poster.autores },
        {
            etiqueta: 'Profesores y materias',
            valor: poster.profesores_resumen || (Array.isArray(poster.profesores) && poster.profesores.length > 0
                ? poster.profesores.map(p => `${p.nombre_profesor}${p.materia ? ` (${p.materia})` : ''}`).join(', ')
                : null),
        },
        {
            etiqueta: 'Evento',
            valor: poster.nombre_evento
                ? `${poster.nombre_evento}${poster.codigo_evento ? ` · ${poster.codigo_evento}` : ''}`
                : null,
        },
        { etiqueta: 'Categoría', valor: categoriaLegible(poster.categoria) },
        { etiqueta: 'Palabras clave', valor: poster.palabras_clave },
        {
            etiqueta: 'Espacio físico',
            valor: poster.nombre_espacio ? `${poster.nombre_espacio}${numeroEspacio ? ` ${numeroEspacio}` : ''}` : null,
        },
        { etiqueta: 'Usuario', valor: poster.nombre_usuario },
    ].filter(d => d.valor);

    return (
        <div className="modal-imagen" onClick={cerrarModal}>
            <section
                className="vista-previa"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`Vista previa del póster ${poster.titulo || ''}`}
            >
                <header className="vista-previa-cabecera">
                    <button className="cerrar-formulario" onClick={cerrarModal} aria-label="Cerrar">X</button>

                    <span className="formularios-eyebrow">Vista previa del póster</span>
                    <h2 className="vista-previa-titulo">{poster.titulo || 'Póster sin título'}</h2>

                    <div className="vista-previa-badges">
                        {poster.nombre_evento && (
                            <span className="badge-evento">
                                <span className="badge-evento-icono" aria-hidden="true">🎓</span>
                                <span className="badge-evento-texto">
                                    {poster.nombre_evento}
                                    {poster.codigo_evento && <small>{poster.codigo_evento}</small>}
                                </span>
                            </span>
                        )}
                        {poster.categoria && <span className="badge-categoria">{categoriaLegible(poster.categoria)}</span>}
                    </div>
                </header>

                <div className="vista-previa-cuerpo">
                    {datos.length > 0 && (
                        <dl className="vista-previa-datos">
                            {datos.map(d => (
                                <div className="vista-previa-dato" key={d.etiqueta}>
                                    <dt>{d.etiqueta}</dt>
                                    <dd>{d.valor}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {poster.descripcion && (
                        <section className="vista-previa-bloque">
                            <h3 className="vista-previa-subtitulo">Descripción</h3>
                            <p className="vista-previa-descripcion">{poster.descripcion}</p>
                        </section>
                    )}

                    <section className="vista-previa-bloque">
                        <div className="vista-previa-archivo-cabecera">
                            <h3 className="vista-previa-subtitulo">
                                {esPdf ? <FaFilePdf aria-hidden="true" /> : <FaImage aria-hidden="true" />}
                                {esPdf ? 'Documento PDF' : 'Imagen del póster'}
                            </h3>

                            {urlArchivo && (
                                <div className="vista-previa-acciones">
                                    <a
                                        className="btn-accion-tabla btn-asignar"
                                        href={urlArchivo}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <FaExternalLinkAlt aria-hidden="true" /> Abrir
                                    </a>
                                    <a
                                        className="btn-accion-tabla"
                                        href={urlArchivo}
                                        download
                                    >
                                        <FaDownload aria-hidden="true" /> Descargar
                                    </a>
                                </div>
                            )}
                        </div>

                        {urlArchivo ? (
                            esPdf ? (
                                <iframe
                                    src={urlArchivo}
                                    className="pdf-grande"
                                    title={`PDF del póster ${poster.titulo || ''}`}
                                />
                            ) : (
                                <img
                                    src={urlArchivo}
                                    alt={poster.titulo || 'Póster completo'}
                                    className="imagen-grande"
                                />
                            )
                        ) : (
                            <p className="vista-previa-vacio">
                                Este póster no tiene archivo cargado.
                            </p>
                        )}
                    </section>
                </div>
            </section>
        </div>
    );
};

export default VistaPreviaPoster;
