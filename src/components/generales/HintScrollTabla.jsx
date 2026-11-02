import React, { useEffect, useRef, useState } from 'react';

/**
 * Barra de desplazamiento horizontal superior sincronizada con sugerencias
 * institucionales visibles para todas las vistas (escritorio y móvil).
 * Debe ubicarse como PRIMER HIJO dentro de cada .contenedor-tabla.
 * 
 * Props:
 * - sugerencia: Texto explicativo de deslizamiento (ej: "Desliza a la derecha para ver más acciones")
 * - verMas: true (usa texto por defecto) o string personalizado ("Da clic en 'Ver más' para ver todas las opciones")
 * - etiqueta: Retrocompatibilidad con implementaciones anteriores
 */
export default function HintScrollTabla({
  sugerencia = 'Desliza a la derecha para ver más acciones y columnas',
  verMas = null,
  etiqueta = null,
}) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const [desborda, setDesborda] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  const textoDeslizar = etiqueta || sugerencia;
  const textoVerMas =
    verMas === true
      ? "Da clic en 'Ver más' para ver todas las opciones"
      : typeof verMas === 'string' && verMas.trim().length > 0
      ? verMas
      : null;

  useEffect(() => {
    const cont = rootRef.current?.parentElement;
    if (!cont) return;

    let syncingFromCont = false;
    let syncingFromTrack = false;

    const actualizar = () => {
      const sw = cont.scrollWidth || 0;
      const cw = cont.clientWidth || 0;
      const hayDesborde = sw > cw + 4;
      setDesborda(hayDesborde);
      setScrollWidth(sw);
    };

    const alScrollCont = () => {
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
    window.addEventListener('resize', actualizar);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        actualizar();
      });
      ro.observe(cont);
      const tabla = cont.querySelector('table');
      if (tabla) ro.observe(tabla);
    }

    actualizar();
    const t1 = setTimeout(actualizar, 100);
    const t2 = setTimeout(actualizar, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
      cont.removeEventListener('scroll', alScrollCont);
      if (track) {
        track.removeEventListener('scroll', alScrollTrack);
      }
      window.removeEventListener('resize', actualizar);
    };
  }, []);

  // Mantener sincronizado el scroll del track superior al cambiar desborda o el contenido
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

    // Mantener la posición sincronizada
    track.scrollLeft = cont.scrollLeft;

    return () => {
      track.removeEventListener('scroll', alScrollTrack);
      cont.removeEventListener('scroll', alScrollCont);
    };
  }, [desborda, scrollWidth]);

  const deslizarADerecha = () => {
    const cont = rootRef.current?.parentElement;
    if (cont) {
      cont.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  // Si no hay desborde y no hay sugerencia de ver más, mantenemos el nodo anclado silencioso
  if (!desborda && !textoVerMas) {
    return <span ref={rootRef} className="hint-scroll-tabla-oculto" aria-hidden="true" />;
  }

  return (
    <div ref={rootRef} className="barra-scroll-top-wrapper">
      <div className="barra-sugerencias-tabla">
        {desborda && (
          <div
            className="item-sugerencia-tabla clickeable"
            role="button"
            tabIndex={0}
            onClick={deslizarADerecha}
            onKeyDown={(e) => e.key === 'Enter' && deslizarADerecha()}
            title="Haz clic para deslizar la tabla hacia la derecha"
          >
            <span aria-hidden="true">👉</span>
            <span>{textoDeslizar}</span>
          </div>
        )}

        {textoVerMas && (
          <div className="item-sugerencia-tabla sugerencia-vermas">
            <span aria-hidden="true">💡</span>
            <span>{textoVerMas}</span>
          </div>
        )}
      </div>

      {desborda && (
        <div
          ref={trackRef}
          className="barra-scroll-top-track"
          title="Desliza para ver más columnas de la tabla"
          role="scrollbar"
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
      )}
    </div>
  );
}
