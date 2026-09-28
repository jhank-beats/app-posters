// src/config.js — URL base del backend.
// Usa el hostname actual para que funcione en localhost Y desde móviles
// en la misma red (ej. http://192.168.1.50:5173 → backend en 192.168.1.50:8000).
// Si el backend corre en otro host/puerto, define VITE_API_BASE en .env.
export const API_BASE =
  import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;
