import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Registro from './components/formularios/Registro';
import Login from './components/formularios/Login';
import HomePage from './components/homePage/HomePage.jsx';
import HomePageSuperAdmin from './components/roles/super_admin/HomePageSuperAdmin';
import HomePageUsuario from './components/roles/usuario/HomePageUsuario.jsx';
import HomePageAdmin from './components/roles/admin/HomePageAdmin.jsx';
import HomePageEvaluador from './components/roles/evaluador/HomePageEvaluador.jsx';
import CargarPosters from './components/formularios/CargarPosters';
import ProtectedRoute from './components/ProtectedRoute';
import PublicPosterRedirect from './components/PublicPosterRedirect';
import Ayuda from './components/generales/Ayuda';
import { useState, useEffect } from 'react';
import { logPageView } from './analytics.js';
import './App.css';

function Layout({ children }) {
  const location = useLocation();
  const noMenuPaths = ["/", "/solo-home", "/superadmin", "/admin", "/evaluador", "/usuario"];

  if (noMenuPaths.includes(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="App">
      <nav>
        <h2>FORMULARIOS DISPONIBLES</h2>
        <a href="/solo-home" target="_blank" rel="noopener noreferrer">
          Página Principal (sin menú)
        </a>{" | "}
        <Link to="/registro">Registro</Link>{" | "}
        <Link to="/login">Login</Link>{" | "}
        <Link to="/CargarPosters">Cargar Posters</Link>{" | "}
        <Link to="/superadmin">Super Admin</Link>
      </nav>
      {children}
    </div>
  );
}

function App() {
  const [user, setUser] = useState([]);
  const location = useLocation();

  useEffect(() => {
    logPageView(location.pathname + location.search);
  }, [location]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/solo-home" element={<HomePage />} />
        <Route path="/registro" element={<Registro setUser={setUser} />} />
        <Route
          path="/login"
          element={
            Object.keys(user).length === 0
              ? <Login setUser={setUser} />
              : <HomePage user={user} />
          }
        />
        <Route path="/CargarPosters" element={<ProtectedRoute roles={[1, 2, 3, 4]}><CargarPosters user={user} /></ProtectedRoute>} />
        <Route path="/superadmin" element={<ProtectedRoute roles={[4]}><HomePageSuperAdmin /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={[3]}><HomePageAdmin /></ProtectedRoute>} />
        <Route path="/evaluador" element={<ProtectedRoute roles={[2]}><HomePageEvaluador /></ProtectedRoute>} />
        <Route path="/usuario" element={<ProtectedRoute roles={[1]}><HomePageUsuario /></ProtectedRoute>} />
        {/* Ruta estable para QR impresos: /poster/:id redirige al archivo vigente */}
        <Route path="/poster/:id" element={<PublicPosterRedirect />} />
        <Route path="/ayuda" element={<Ayuda />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Layout>
  );
}

export default App;
