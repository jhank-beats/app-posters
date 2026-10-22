// src/config.js — base única de URLs del backend y de archivos.
// Por defecto rutas RELATIVAS al origen actual (funciona detrás de Nginx/HTTPS
// y en local con proxy). Override con VITE_API_BASE / VITE_FILES_BASE en .env.
//
// Desarrollo local sin proxy (vite + php -S -t backend :8000):
//   VITE_API_BASE=http://localhost:8000/api
//   VITE_FILES_BASE=http://localhost:8000/imgPosters
//
// Producción (mismo origen): dejar sin definir → /api y /imgPosters.

const devApiFallback = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000/api`
  : '/api';
const devFilesFallback = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000/imgPosters`
  : '/imgPosters';

export const API_BASE = (import.meta.env.VITE_API_BASE || devApiFallback).replace(/\/$/, '');
export const FILES_BASE = (import.meta.env.VITE_FILES_BASE || devFilesFallback).replace(/\/$/, '');

/** URL pública de un archivo de póster (clave o ruta legacy). */
export function urlArchivo(ruta) {
  if (!ruta) return null;
  const clave = String(ruta).split('/').pop();
  if (!clave) return null;
  return `${FILES_BASE}/${encodeURIComponent(clave)}`;
}
