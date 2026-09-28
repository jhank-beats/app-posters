// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // 👈 importa BrowserRouter
import App from "./App.jsx";
import "./index.css";
import "./auth.js"; // parche global: inyecta el token en todo fetch() a /api/
import { initGA } from "./analytics.js";

// Inicializa Google Analytics una vez al arrancar la app
initGA();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>     {/* 👈 Envuelve aquí toda tu app */}
      <App />
    </BrowserRouter>
  </StrictMode>
);
