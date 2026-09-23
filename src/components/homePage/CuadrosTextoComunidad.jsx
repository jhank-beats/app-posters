import './HomePage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const CuadrosTextoComunidad = ({ imagen, icono, color = '#00acc9', titulo, descripcion }) => {
    return (
        <article className='tarjeta-comunidad' style={{ '--acento-tarjeta': color }}>
            {icono ? (
                <span className='icono-tarjeta-comunidad' aria-hidden="true">
                    <FontAwesomeIcon icon={icono} />
                </span>
            ) : (
                <img className='imagen-cuadro-comunidad' src={imagen} alt="imagen" />
            )}
            <h3 className='subtitulo-cuadro-comunidad'>{titulo}</h3>
            <p className='descripcion-comunidad'>{descripcion}</p>
        </article>
    );

}

export default CuadrosTextoComunidad;
