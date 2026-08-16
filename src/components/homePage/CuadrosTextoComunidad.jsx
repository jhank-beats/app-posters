import './HomePage.css';

const CuadrosTextoComunidad = ({imagen, titulo, descripcion}) => {
    return (
        <div>
            <img className='imagen-cuadro-comunidad' src={imagen} alt="imagen" />
            <h3 className='subtitulo-cuadro-comunidad'>{titulo}</h3>
            <p className='descripcion-comunidad'>{descripcion}</p>
        </div>
    );

}

export default CuadrosTextoComunidad;