import React, { useState, useEffect } from 'react';

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

    const buttonStyle = {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        display: visible ? 'block' : 'none',
        padding: '10px 15px',
        fontSize: '18px',
        borderRadius: '50%',
        backgroundColor: '#3333338a',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        zIndex: 1000,
    };

    return (
        <button style={buttonStyle} onClick={scrollToTop} aria-label="Volver arriba">
            ↑
        </button>
    );
};

export default VolverArriba;