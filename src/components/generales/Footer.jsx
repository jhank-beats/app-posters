import React from "react";

const Footer = () => {
    return (
        <footer className="footer">
            <div className="contenedor-footer">
                <div className="footer-columna">
                    <img
                        className='logo-ucc'
                        src='/img/logoucc.png'
                        alt="Logo UCC"
                    />
                    <p className="footer-texto">
                        Comunidad de Ingeniería de Sistemas. Plataforma institucional para gestión y evaluación de pósteres.
                    </p>
                </div>

                <div className="footer-columna">
                    <h4>Explora</h4>
                    <ul>
                        <li><a href="#">Inicio</a></li>
                        <li><a href="#">Eventos</a></li>
                        <li><a href="#">Proyectos</a></li>
                        <li><a href="#">Noticias</a></li>
                    </ul>
                </div>

                <div className="footer-columna">
                    <h4>Recursos</h4>
                    <ul>
                        <li><a href="#">Repositorio</a></li>
                        <li><a href="#">Guías</a></li>
                        <li><a href="#">Foro</a></li>
                        <li><a href="#">Contacto</a></li>
                    </ul>
                </div>

                <div className="footer-columna">
                    <h4>Contáctanos</h4>
                    <p>gensTI@ucc.edu.co</p>
                    <p>+57 314 000 0000</p>
                    <p>Ibagué - Colombia</p>
                </div>
            </div>

            <div className="footer-copy-creditos">
                <p>© 2025 GensTI - Universidad Cooperativa de Colombia</p>
                <p className="creditos">Desarrollado por <strong>Juan Camilo Murillo / Semillero DivitGames</strong> </p>
            </div>
        </footer>
    );
};

export default Footer;
