// src/auth.js — Sesión del lado cliente + inyección automática del token.
// El backend verifica el token (HMAC) en cada endpoint protegido.
import { API_BASE } from './config.js';

const TOKEN_KEY = "authToken";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function getRol() {
  const r = parseInt(localStorage.getItem("id_rol") || "0", 10);
  return Number.isFinite(r) ? r : 0;
}
export function isLoggedIn() {
  return !!(getToken() && localStorage.getItem("idUsuario"));
}
export function saveSession({ token, usuario }) {
  localStorage.setItem(TOKEN_KEY, token || "");
  localStorage.setItem("idUsuario", String(usuario.id));
  localStorage.setItem("id_rol", String(usuario.id_rol));
  localStorage.setItem("nombreUsuario", `${usuario.nombres} ${usuario.apellidos}`);
  if (usuario.carrera) {
    localStorage.setItem("carreraUsuario", String(usuario.carrera));
  }
  if (usuario.id_evento) {
    localStorage.setItem("idEventoAdmin", String(usuario.id_evento));
  } else {
    localStorage.removeItem("idEventoAdmin");
  }
  if (usuario.nombre_evento_asignado) {
    localStorage.setItem("nombreEventoAdmin", String(usuario.nombre_evento_asignado));
  } else {
    localStorage.removeItem("nombreEventoAdmin");
  }
}
export function clearSession() {
  ["authToken", "token", "user", "idUsuario", "id_rol", "rol", "rolUsuario",
   "nombreUsuario", "usuario", "id_usuario", "carreraUsuario",
   "idEventoAdmin", "nombreEventoAdmin"].forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  });
}
export function authHeaders(extra = {}) {
  const t = getToken();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : { ...extra };
}

// Parche global: todo fetch() a la API lleva el token sin tocar los call-sites.
function patchFetch() {
  if (window.__authFetchPatched) return;
  window.__authFetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const token = getToken();
    const base = String(API_BASE || "").replace(/\/$/, "");
    const esApi = base && (url.startsWith(base) || url.includes("/api/"));
    if (token && esApi) {
      const headers = new Headers(init.headers || (typeof input !== "string" && input.headers) || {});
      if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      init = { ...init, headers };
    }
    return orig(input, init);
  };
}
patchFetch();
