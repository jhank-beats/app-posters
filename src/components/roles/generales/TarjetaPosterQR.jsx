import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const TarjetaPosterQR = ({ poster, urlDigital }) => {
    const qrRef = useRef(null);

    // URL a la que apuntará el código QR: prop explícita, imagen digital o fallback por id.
    const valorQR = urlDigital || poster.imagen || `http://localhost/app-posters/backend/imgPosters/${poster.id}`;

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
                className="solicitar-registro"
                type="button"
            >
                ⬇ Descargar QR
            </button>
        </div>
    );
};

export default TarjetaPosterQR;