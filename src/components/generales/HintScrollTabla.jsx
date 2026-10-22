import React, { useEffect, useRef, useState } from 'react';

/**
 * Pista "Desliza →" para tablas en móvil.
 * Colocar como PRIMER HIJO de un .contenedor-tabla (que ya hace overflow-x).
 * Se oculta al scrollear o al tocar la pista.
 */
export default function HintScrollTabla({ etiqueta = 'Desliza → para ver más columnas' }) {
  const elRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cont = elRef.current?.parentElement;
    if (!cont) return;

    let tocado = false;
    const evaluar = () => {
      if (tocado) return;
      const ancho = window.innerWidth || 0;
      const desborda = cont.scrollWidth > cont.clientWidth + 8;
      setVisible(ancho <= 768 && desborda);
    };

    const alScroll = () => {
      if (cont.scrollLeft > 12) {
        tocado = true;
        setVisible(false);
      }
    };

    evaluar();
    const t = setTimeout(evaluar, 250);
    window.addEventListener('resize', evaluar);
    cont.addEventListener('scroll', alScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', evaluar);
      cont.removeEventListener('scroll', alScroll);
    };
  }, []);

  if (!visible) return <span ref={elRef} className="hint-scroll-tabla-oculto" aria-hidden="true" />;

  return (
    <div
      ref={elRef}
      className="hint-scroll-tabla"
      role="status"
      onClick={(e) => {
        const cont = e.currentTarget.parentElement;
        if (cont) cont.scrollLeft = 140;
        setVisible(false);
      }}
    >
      {etiqueta}
    </div>
  );
}
