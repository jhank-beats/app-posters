import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFacebook,
    faInstagram,
    faWhatsapp,
    faYoutube,
} from '@fortawesome/free-brands-svg-icons';

const Footer = () => {
    return (
        <footer className="footer seccion-footer">
            <div className="contenedor-footer">

                {/* Columna 1: Marca */}
                <div className="footer-columna footer-columna-marca">
                    <img
                        className='logo-ucc'
                        src='/img/logoucc.png'
                        alt="Logo UCC"
                    />
                    <h3 className="footer-marca-nombre">Comunidad GensTI</h3>
                    <p className="footer-texto">
                        Comunidad de la Facultad de Ingeniería de Sistemas de la Universidad Cooperativa de Colombia.
                    </p>
                </div>

                {/* Columna 2: Enlaces */}
                <div className="footer-columna">
                    <h4>Enlaces</h4>
                    <ul>
                        <li><a href="#">Inicio</a></li>
                        <li><a href="#">Comunidad GensTI</a></li>
                        <li><a href="#">Novedades</a></li>
                        <li><a href="#">Posters</a></li>
                    </ul>
                </div>

                {/* Columna 3: Información */}
                <div className="footer-columna">
                    <h4>Información</h4>
                    <ul>
                        <li><span className="footer-info-item">Universidad Cooperativa de Colombia</span></li>
                        <li><span className="footer-info-item">Facultad de Ingeniería de Sistemas</span></li>
                    </ul>
                </div>

                {/* Columna 4: Síguenos */}
                <div className="footer-columna">
                    <h4>Síguenos</h4>
                    <ul className="footer-redes">
                        <li>
                            <a href="#" aria-label="Facebook">
                                <FontAwesomeIcon icon={faFacebook} />
                                <span>Facebook</span>
                            </a>
                        </li>
                        <li>
                            <a href="#" aria-label="Instagram">
                                <FontAwesomeIcon icon={faInstagram} />
                                <span>Instagram</span>
                            </a>
                        </li>
                        <li>
                            <a href="#" aria-label="WhatsApp">
                                <FontAwesomeIcon icon={faWhatsapp} />
                                <span>WhatsApp</span>
                            </a>
                        </li>
                        <li>
                            <a href="#" aria-label="YouTube">
                                <FontAwesomeIcon icon={faYoutube} />
                                <span>YouTube</span>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="footer-copy-creditos">
                <p>© 2025 GensTI - Universidad Cooperativa de Colombia</p>
                <p className="creditos">Desarrollado por <strong>Juan Camilo Murillo / Semillero DivitGames</strong></p>
            </div>
        </footer>
    );
};

export default Footer;