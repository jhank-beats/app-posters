import '../generales/roles.css';
import { Link } from "react-scroll";
import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import NotificacionesBell from '../generales/NotificacionesBell.jsx';
import { clearSession } from '../../../auth.js';

const HeaderSuperAdmin = ({ abrirCuenta }) => {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [menuUsuario, setMenuUsuario] = useState(false);
    const navigate = useNavigate();

    const cerrarSesion = () => {
        clearSession();
        setMenuUsuario(false);
        navigate('/solo-home');
    };

    const cerrarMenus = () => {
        setMenuAbierto(false);
        setMenuUsuario(false);
    };

    return (
        <header className='encabezado encabezado-app encabezado-compacto'>
            <div className='header-contenedor'>
                <div className='logo-nav'>
                    <Link to="inicio" smooth={true} duration={500} offset={-84} className='logo-enlace' onClick={cerrarMenus}>
                        <img className='logo-ucc' src='/img/logoucc.png' alt="Logo UCC" />
                    </Link>
                </div>

                <nav className={`menu-nav ${menuAbierto ? 'activo' : ''}`}>
                        <button onClick={() => setMenuAbierto(false)} className='boton-cerrar' aria-label="Cerrar menú">X</button>
                        <Link className='menu-enlace' to="inicio" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Inicio</Link>
                        <Link className='menu-enlace' to="pendientes" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Pendientes</Link>
                        <Link className='menu-enlace' to="criterios" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Criterios</Link>
                        <Link className='menu-enlace' to="posters" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Posters</Link>
                        <Link className='menu-enlace' to="espacios" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Espacios</Link>
                        <Link className='menu-enlace' to="usuarios" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Usuarios</Link>
                        <Link className='menu-enlace' to="categorias" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Categorías</Link>
                        <Link className='menu-enlace' to="eventos" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Eventos</Link>
                        <Link className='menu-enlace' to="rondas" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Rondas</Link>
                        <Link className='menu-enlace' to="recordatorios" smooth={true} duration={500} offset={-84} onClick={() => setMenuAbierto(false)}>Recordatorios</Link>
                </nav>

                <div className='acciones-header'>
                    <div className={`menu-usuario ${menuUsuario ? 'activo' : ''}`}>
                        <button onClick={() => setMenuUsuario(false)} className='boton-cerrar' aria-label="Cerrar menú usuario">&times;</button>
                        <a className='enlace-login' href="#" onClick={(e) => { e.preventDefault(); setMenuUsuario(false); if (abrirCuenta) abrirCuenta(); }}>Mi Cuenta</a>
                        <button className='boton-registro' onClick={cerrarSesion}>Cerrar Sesión</button>
                    </div>

                    <NotificacionesBell tipo="super_admin" />

                <div className='boton-usuario'>
                        <button onClick={() => setMenuUsuario(!menuUsuario)} aria-label="Abrir menú de usuario">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="24" height="24" fill="currentColor"><path d="M470.5 463.6C451.4 416.9 405.5 384 352 384L288 384C234.5 384 188.6 416.9 169.5 463.6C133.9 426.3 112 375.7 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320C528 375.7 506.1 426.2 470.5 463.6zM430.4 496.3C398.4 516.4 360.6 528 320 528C279.4 528 241.6 516.4 209.5 496.3C216.8 459.6 249.2 432 288 432L352 432C390.8 432 423.2 459.6 430.5 496.3zM320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM320 304C297.9 304 280 286.1 280 264C280 241.9 297.9 224 320 224C342.1 224 360 241.9 360 264C360 286.1 342.1 304 320 304zM232 264C232 312.6 271.4 352 320 352C368.6 352 408 312.6 408 264C408 215.4 368.6 176 320 176C271.4 176 232 215.4 232 264z"/></svg>
                        </button>
                    </div>

                    <div className='boton-hamburguesa'>
                        <button onClick={() => setMenuAbierto(!menuAbierto)} aria-label="Abrir menú de navegación">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="24" height="24" fill="currentColor"><path d="M96 160C96 142.3 110.3 128 128 128L512 128C529.7 128 544 142.3 544 160C544 177.7 529.7 192 512 192L128 192C110.3 192 96 177.7 96 160zM96 320C96 302.3 110.3 288 128 288L512 288C529.7 288 544 302.3 544 320C544 337.7 529.7 352 512 352L128 352C110.3 352 96 337.7 96 320zM544 480C544 497.7 529.7 512 512 512L128 512C110.3 512 96 497.7 96 480C96 462.3 110.3 448 128 448L512 448C529.7 448 544 462.3 544 480z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            {(menuAbierto || menuUsuario) && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    className="menu-overlay"
                    onClick={cerrarMenus}
                />
            )}
        </header>
    );
}

export default HeaderSuperAdmin;
