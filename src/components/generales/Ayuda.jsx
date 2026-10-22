import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Ayuda breve de uso de la plataforma (ruta /ayuda).
 */
export default function Ayuda() {
  return (
    <div className="contenedor-formulario" style={{ maxWidth: 720, margin: '2rem auto', textAlign: 'left' }}>
      <h2 style={{ marginTop: 0 }}>❓ Ayuda y sugerencias de uso</h2>

      <section style={{ marginBottom: '1.25rem' }}>
        <h3>📱 En el celular</h3>
        <ul>
          <li>Las <strong>tablas</strong> se pueden desplazar de lado: busca la pista <em>“Desliza → para ver más columnas”</em> y arrastra la tabla con el dedo.</li>
          <li>Los menús de las pantallas de rol se abren con el botón <strong>☰</strong> (arriba).</li>
          <li>Si un texto se ve cortado, gira el teléfono a horizontal o toca la fila para ver el detalle.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.25rem' }}>
        <h3>🔑 Contraseña</h3>
        <ul>
          <li>Si entraste con una <strong>contraseña temporal</strong> (carga masiva de usuarios), cámbiala en <strong>Mi cuenta</strong> cuanto antes.</li>
          <li>Si la olvidaste, un administrador o superadmin puede apoyarte desde el panel de usuarios.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.25rem' }}>
        <h3>📤 Subir un póster</h3>
        <ul>
          <li>Formatos admitidos: <strong>PDF, JPG o PNG</strong> (máximo 10 MB).</li>
          <li>Busca al profesor escribiendo sus <strong>primeras letras</strong> en el campo de profesor.</li>
          <li>Si el sistema avisa de un posible duplicado, revisa el título y las palabras clave.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.25rem' }}>
        <h3>📷 Códigos QR</h3>
        <ul>
          <li>El QR abre la URL estable <code>/poster/:id</code> y de ahí el archivo del póster.</li>
          <li>Si un QR no abre: confirma que el móvil está en la red del evento y que el póster sigue activo.</li>
        </ul>
      </section>

      <section>
        <h3>🧪 ¿Eres admin?</h3>
        <ul>
          <li>Puedes <strong>importar usuarios por CSV</strong> (solo superadmin) con el botón en la pantalla de Usuarios.</li>
          <li>La plantilla y el formato de columnas están en el mismo diálogo de importación.</li>
        </ul>
      </section>

      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/">← Volver al inicio</Link>
      </p>
    </div>
  );
}
