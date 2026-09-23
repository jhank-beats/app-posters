import React, { useState, useEffect } from 'react';
import './VolverArriba.css';

const VolverArriba = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setVisible(window.scrollY > 63);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <button className={`boton-arriba ${visible ? 'boton-arriba-visible' : ''}`} onClick={scrollToTop} aria-label="Volver arriba">
            ↑
        </button>
    );
};

export default VolverArriba;