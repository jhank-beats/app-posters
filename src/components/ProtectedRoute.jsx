import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn, getRol } from "../auth.js";

// Roles: 1=usuario 2=evaluador 3=admin (por evento) 4=superadmin (ve todo).
const ROL_POR_RUTA = {
  "/superadmin": "superadmin",
  "/admin": "admin",
  "/evaluador": "evaluador",
  "/usuario": "usuario",
};

export default function ProtectedRoute({ children, roles }) {
  const location = useLocation();
  const destino = ROL_POR_RUTA[location.pathname] || "este panel";

  // Sin sesión o sin rol suficiente → homepage con modal de login + aviso.
  if (!isLoggedIn()) {
    return <Navigate to={`/?acceso=denegado&rol=${destino}`} replace />;
  }
  if (Array.isArray(roles) && roles.length > 0) {
    const rol = getRol();
    if (rol !== 4 && !roles.includes(rol)) {
      return <Navigate to={`/?acceso=denegado&rol=${destino}`} replace />;
    }
  }
  return children;
}
