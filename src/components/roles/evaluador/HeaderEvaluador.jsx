import '../generales/roles.css';
import { Link } from "react-scroll";
import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { FaPlus } from "react-icons/fa";

const HeaderEvaluador = ({ abrirCuenta }) => {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [menuUsuario, setMenuUsuario] = useState(false); 
    const [user, setUser] = useState(null); 
    const navigate = useNavigate();

    const cerrarSesion = () => {
        setUser(null);
        if (window.localStorage) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('idUsuario');
            localStorage.removeItem('nombreUsuario');
        }
        setMenuUsuario(false);
        navigate('/solo-home');
    }

    return (
        <header className='encabezado'>
            {/* Logo + Nav */}
            <div className='logo-nav'>
                
                <img
                    className='logo-ucc'
                    src='/img/logoucc.png'
                    alt="Logo UCC"
                />
                <nav className={`menu-nav ${menuAbierto ? 'activo' : ''}`}>
                    <button onClick={() => setMenuAbierto(false)} className='boton-cerrar'>X</button>
                    <Link to="inicio" smooth={true} duration={500} onClick={() => setMenuAbierto(false)}>Inicio</Link>
                    <Link to="pendientes" smooth={true} duration={500} onClick={() => setMenuAbierto(false)}>Usuarios Pendientes</Link>
                    <Link to="posters" smooth={true} duration={500} onClick={() => setMenuAbierto(false)}>Posters</Link>
                    <Link to="usuarios" smooth={true} duration={500} onClick={() => setMenuAbierto(false)}>Usuarios</Link>
                    <Link to="categorias" smooth={true} duration={500} onClick={() => setMenuAbierto(false)}>Categorías</Link>
                </nav>
            </div>

            {/* Botones de sesión + hamburguesa */}
            <div className='acciones-header'>
                <div className={`menu-usuario ${menuUsuario ? 'activo' : ''}`}>
                    <button onClick={() => setMenuUsuario(false)} className='boton-cerrar'>&times;</button>
                    <a href="#" onClick={(e) => {
                        e.preventDefault();
                        setMenuUsuario(false);
                        if (abrirCuenta) abrirCuenta();
                    }}>
                        Mi Cuenta
                    </a>
                    <a href="#">Notificaciones</a>
                    <button
                        href="#"
                        onClick={cerrarSesion}
                    >
                        Cerrar Sesión
                    </button>
                </div>

                <div className='boton-usuario'>
                    <button onClick={() => setMenuUsuario(!menuUsuario)}>
                        <FaPlus/>
                    </button>
                </div>

                <div className='boton-hamburguesa'>
                    <button onClick={() => setMenuAbierto(!menuAbierto)}>
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 640 640" 
                            width="24" 
                            height="24" 
                            fill="currentColor"
                            color='#5f5e5e'>
                            <path d="M96 160C96 142.3 110.3 128 128 128L512 128C529.7 128 
                            544 142.3 544 160C544 177.7 529.7 192 512 192L128 
                            192C110.3 192 96 177.7 96 160zM96 320C96 302.3 110.3 
                            288 128 288L512 288C529.7 288 544 302.3 544 
                            320C544 337.7 529.7 352 512 352L128 
                            352C110.3 352 96 337.7 96 320zM544 
                            480C544 497.7 529.7 512 512 512L128 
                            512C110.3 512 96 497.7 96 480C96 462.3 
                            110.3 448 128 448L512 448C529.7 448 
                            544 462.3 544 480z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
}

export default HeaderEvaluador;