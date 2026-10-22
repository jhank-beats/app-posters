import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, urlArchivo } from '../config.js';

/**
 * Ruta estable /poster/:id — usada por los QR impresos.
 * Resuelve el archivo vigente del póster y redirige a él.
 * Si no existe o no se puede resolver, muestra un aviso simple.
 */
export default function PublicPosterRedirect() {
  const { id } = useParams();
  const [estado, setEstado] = useState('cargando');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/TablaPosters.php?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const poster = Array.isArray(data?.data) ? data.data[0] : (data?.data || data?.posters?.[0] || null);
        const clave = poster?.imagen || poster?.ruta_imagen || null;
        const url = urlArchivo(clave);
        if (!cancelado) {
          if (url) {
            setEstado('redirigiendo');
            window.location.replace(url);
          } else {
            setEstado('error');
            setMensaje('No se encontró el archivo de este póster.');
          }
        }
      } catch {
        if (!cancelado) {
          setEstado('error');
          setMensaje('No se pudo cargar el póster. Intenta de nuevo más tarde.');
        }
      }
    })();
    return () => { cancelado = true; };
  }, [id]);

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      {estado === 'cargando' || estado === 'redirigiendo' ? (
        <p>Abriendo el póster…</p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Póster no disponible</h1>
          <p>{mensaje}</p>
          <p><Link to="/">Volver al inicio</Link></p>
        </>
      )}
    </div>
  );
}
