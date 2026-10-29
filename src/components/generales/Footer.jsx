import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFacebook,
    faInstagram,
    faWhatsapp,
    faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import PreguntasFrecuentes from "../homePage/PreguntasFrecuentes.jsx";

const Footer = () => {
    const [mostrarPreguntas, setMostrarPreguntas] = useState(false);

    return (
        <>
            <footer className="footer seccion-footer">
                <div className="contenedor-footer">

                    {/* Columna 1: Marca */}
                    <div className="footer-columna footer-columna-marca">
                        <img
                            className='logo-ucc'
                            src='/img/logoucc.png'
                            alt="Logo UCC"
                        />
                        <h3 className="footer-marca-nombre">Facultad de Ingeniería · UCC</h3>
                        <p className="footer-texto">
                            Plataforma académica de Ingeniería de Sistemas (Comunidad GensTI) e Ingeniería Civil de la Universidad Cooperativa de Colombia.
                        </p>
                    </div>

                    {/* Columna 2: Enlaces */}
                    <div className="footer-columna">
                        <h4>Enlaces</h4>
                        <ul>
                            <li><Link to="/">Inicio</Link></li>
                            <li><Link to="/">Comunidad</Link></li>
                            <li><Link to="/">Novedades</Link></li>
                            <li>
                                <a
                                    href="/img/Plantilla-Poster-Bienal-2026.pptx"
                                    download="Frm.Poster.Bienal.2026.pptx"
                                >
                                    Posters
                                </a>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    className="footer-btn-link"
                                    onClick={() => setMostrarPreguntas(true)}
                                >
                                    Ayuda y sugerencias
                                </button>
                            </li>
                        </ul>
                    </div>

                {/* Columna 3: Información */}
                <div className="footer-columna">
                    <h4>Información</h4>
                    <ul>
                        <li>
                            <a
                                href="https://www.ucc.edu.co"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-info-item"
                            >
                                Universidad Cooperativa de Colombia
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://www.ucc.edu.co/programas/pregrados/bogota/ingenieria-de-sistemas"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-info-item"
                            >
                                Ingeniería de Sistemas · Comunidad GensTI
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://www.ucc.edu.co/programas/pregrados/medellin/ingenieria-civil"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-info-item"
                            >
                                Ingeniería Civil
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Columna 4: Síguenos */}
                <div className="footer-columna">
                    <h4>Síguenos</h4>
                    <ul className="footer-redes">
                        <li>
                            <a
                                href="https://www.facebook.com/UCooperativadeColombia"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Facebook"
                            >
                                <FontAwesomeIcon icon={faFacebook} />
                                <span>Facebook</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://www.instagram.com/ucc_oficial/"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Instagram"
                            >
                                <FontAwesomeIcon icon={faInstagram} />
                                <span>Instagram</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://wa.me/573124689345"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="WhatsApp"
                            >
                                <FontAwesomeIcon icon={faWhatsapp} />
                                <span>WhatsApp</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://www.youtube.com/@UCC_Oficial"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="YouTube"
                            >
                                <FontAwesomeIcon icon={faYoutube} />
                                <span>YouTube</span>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="footer-copy-creditos">
                <p>© 2026 Facultad de Ingeniería (GensTI & Civil) - Universidad Cooperativa de Colombia</p>
                <p className="creditos">Desarrollado por <strong>Juan Camilo Murillo / Semillero DivitGames</strong></p>
            </div>
        </footer>

        {mostrarPreguntas && (
            <PreguntasFrecuentes cerrar={() => setMostrarPreguntas(false)} />
        )}
    </>
    );
};

export default Footer;