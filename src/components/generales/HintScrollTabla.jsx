import React, { useEffect, useRef, useState } from 'react';

/**
 * Barra de desplazamiento horizontal superior para tablas en todos los roles.
 * Debe ubicarse como PRIMER HIJO dentro de cada .contenedor-tabla.
 * Mueve la barra de scroll a la parte superior de la tabla y se sincroniza
 * de manera bidireccional con el desplazamiento horizontal del contenedor.
 */
export default function HintScrollTabla({ etiqueta = 'Desliza → para ver más columnas' }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const [desborda, setDesborda] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const [mostrarHintMovil, setMostrarHintMovil] = useState(false);

  useEffect(() => {
    const cont = rootRef.current?.parentElement;
    if (!cont) return;

    let syncingFromCont = false;
    let syncingFromTrack = false;
    let hintTocado = false;

    const actualizarDimensiones = () => {
      const sw = cont.scrollWidth || 0;
      const cw = cont.clientWidth || 0;
      const hayDesborde = sw > cw + 4;
      setDesborda(hayDesborde);
      setScrollWidth(sw);
      setClientWidth(cw);

      const anchoVentana = window.innerWidth || 0;
      if (!hintTocado) {
        setMostrarHintMovil(anchoVentana <= 768 && hayDesborde);
      }
    };

    const alScrollCont = () => {
      if (cont.scrollLeft > 12) {
        hintTocado = true;
        setMostrarHintMovil(false);
      }
      if (syncingFromTrack) return;
      if (trackRef.current) {
        syncingFromCont = true;
        trackRef.current.scrollLeft = cont.scrollLeft;
        syncingFromCont = false;
      }
    };

    const alScrollTrack = () => {
      if (syncingFromCont) return;
      if (trackRef.current) {
        syncingFromTrack = true;
        cont.scrollLeft = trackRef.current.scrollLeft;
        syncingFromTrack = false;
      }
    };

    const track = trackRef.current;
    if (track) {
      track.addEventListener('scroll', alScrollTrack, { passive: true });
    }
    cont.addEventListener('scroll', alScrollCont, { passive: true });
    window.addEventListener('resize', actualizarDimensiones);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        actualizarDimensiones();
      });
      ro.observe(cont);
      const tabla = cont.querySelector('table');
      if (tabla) ro.observe(tabla);
    }

    actualizarDimensiones();
    const t1 = setTimeout(actualizarDimensiones, 150);
    const t2 = setTimeout(actualizarDimensiones, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
      cont.removeEventListener('scroll', alScrollCont);
      if (track) {
        track.removeEventListener('scroll', alScrollTrack);
      }
      window.removeEventListener('resize', actualizarDimensiones);
    };
  }, []);

  // Mantener sincronizado el listener del track al cambiar desborda o scrollWidth
  useEffect(() => {
    const track = trackRef.current;
    const cont = rootRef.current?.parentElement;
    if (!track || !cont) return;

    let syncingCont = false;
    let syncingTrack = false;

    const alScrollTrack = () => {
      if (syncingCont) return;
      syncingTrack = true;
      cont.scrollLeft = track.scrollLeft;
      syncingTrack = false;
    };

    const alScrollCont = () => {
      if (syncingTrack) return;
      syncingCont = true;
      track.scrollLeft = cont.scrollLeft;
      syncingCont = false;
    };

    track.addEventListener('scroll', alScrollTrack, { passive: true });
    cont.addEventListener('scroll', alScrollCont, { passive: true });

    // Mantener la posición actual sincronizada
    track.scrollLeft = cont.scrollLeft;

    return () => {
      track.removeEventListener('scroll', alScrollTrack);
      cont.removeEventListener('scroll', alScrollCont);
    };
  }, [desborda, scrollWidth]);

  return (
    <div
      ref={rootRef}
      className="barra-scroll-top-wrapper"
      style={{
        position: 'sticky',
        left: 0,
        width: clientWidth ? `${clientWidth}px` : '100%',
        maxWidth: '100%',
        zIndex: 6,
        display: desborda ? 'block' : 'none',
        marginBottom: '0.5rem',
      }}
    >
      {mostrarHintMovil && (
        <div
          className="hint-scroll-tabla"
          role="status"
          onClick={() => {
            const cont = rootRef.current?.parentElement;
            if (cont) cont.scrollLeft = 140;
            setMostrarHintMovil(false);
          }}
        >
          {etiqueta}
        </div>
      )}
      <div
        ref={trackRef}
        className="barra-scroll-top-track"
        title="Desliza para ver más columnas de la tabla"
      >
        <div
          className="barra-scroll-top-dummy"
          style={{
            width: `${scrollWidth}px`,
            height: '1px',
            minWidth: `${scrollWidth}px`,
          }}
        />
      </div>
    </div>
  );
}
