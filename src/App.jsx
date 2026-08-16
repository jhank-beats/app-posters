import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Registro from './components/formularios/Registro';
import Login from './components/formularios/Login';
import HomePage from './components/homePage/HomePage.jsx';
import HomePageSuperAdmin from './components/roles/super_admin/HomePageSuperAdmin';
import HomePageUsuario from './components/roles/usuario/HomePageUsuario.jsx';
import HomePageAdmin from './components/roles/admin/HomePageAdmin.jsx';
import HomePageEvaluador from './components/roles/evaluador/HomePageEvaluador.jsx';
import CargarPosters from './components/formularios/CargarPosters';
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
        <Route path="/CargarPosters" element={<CargarPosters user={user} />} />
        <Route path="/superadmin" element={<HomePageSuperAdmin />} />
        <Route path="/admin" element={<HomePageAdmin />} />
        <Route path="/evaluador" element={<HomePageEvaluador />} />
        <Route path="/usuario" element={<HomePageUsuario />} />
      </Routes>
    </Layout>
  );
}

export default App;
