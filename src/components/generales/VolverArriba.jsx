import React, { useState, useEffect } from 'react';
import './VolverArriba.css';

const VolverArriba = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            // rAF + passive: no bloquear el hilo de scroll (crítico en Firefox)
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                const next = window.scrollY > 63;
                setVisible((prev) => (prev === next ? prev : next));
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
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