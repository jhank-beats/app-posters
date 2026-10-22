import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const TarjetaPosterQR = ({ poster, urlDigital }) => {
    const qrRef = useRef(null);

    // El QR SIEMPRE apunta a la ruta estable /poster/:id de la SPA.
    // Así el QR no se rompe si cambia el dominio, el puerto o el nombre del archivo.
    const valorQR = urlDigital
        || (poster?.id != null
            ? `${window.location.origin}/poster/${poster.id}`
            : null);

    const descargarQR = () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (!canvas) return;
        const enlace = document.createElement('a');
        enlace.download = `QR-poster-${poster.id || 'digital'}.png`;
        enlace.href = canvas.toDataURL('image/png');
        enlace.click();
    };

    return (
        <div className="contenedor-formulario" style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px', fontWeight: 'bold' }}>{poster.titulo}</p>
            {poster.nombre_evento && (
                <p style={{ margin: '0 0 5px' }}>
                    <span className="badge-evento">
                        <span className="badge-evento-icono" aria-hidden="true">🎓</span>
                        <span className="badge-evento-texto">
                            {poster.nombre_evento}
                            {poster.codigo_evento && <small>{poster.codigo_evento}</small>}
                        </span>
                    </span>
                </p>
            )}
            <p style={{ margin: '0 0 10px', fontSize: '0.9em' }}><strong>Autor(es):</strong> {poster.autores} · <strong>Categoría:</strong> {poster.categoria}</p>

            <div ref={qrRef} style={{ margin: '15px 0', display: 'flex', justifyContent: 'center' }}>
                <QRCodeCanvas
                    value={valorQR}
                    size={180}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"H"}
                    includeMargin={true}
                />
            </div>

            <button
                onClick={descargarQR}
                className="boton-primario"
                type="button"
            >
                ⬇ Descargar QR
            </button>
        </div>
    );
};

export default TarjetaPosterQR;