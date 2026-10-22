import React, { useState } from 'react';
import { API_BASE } from '../../../config.js';

const COLUMNAS = [
  { nombre: 'nombres', req: 'sí', ejemplo: 'Ana' },
  { nombre: 'apellidos', req: 'sí', ejemplo: 'Pérez' },
  { nombre: 'correo', req: 'sí', ejemplo: 'ana.perez@campusucc.edu.co' },
  { nombre: 'carrera', req: 'sí', ejemplo: 'sistemas | civil | administracion | derecho' },
  { nombre: 'rol', req: 'no', ejemplo: 'usuario | evaluador | admin (default: usuario)' },
  { nombre: 'id_evento', req: 'no', ejemplo: '1 (solo para rol admin)' },
];

const PLANTILLA =
  'nombres,apellidos,correo,carrera,rol\n' +
  'Ana,Pérez,ana.perez@campusucc.edu.co,sistemas,usuario\n' +
  'Luis,Gómez,luis.gomez@campusucc.edu.co,civil,evaluador\n' +
  'María,Rojas,maria.rojas@campusucc.edu.co,administracion,admin\n';

function descargarPlantilla() {
  const blob = new Blob([PLANTILLA], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_usuarios.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportarUsuariosModal({ cerrar, onImportado }) {
  const [textoCsv, setTextoCsv] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const alElegirArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);
    setError('');
    const texto = await file.text();
    setTextoCsv(texto);
    setResultado(null);
  };

  const importar = async () => {
    if (!textoCsv.trim()) {
      setError('Selecciona un archivo CSV o pega el contenido.');
      return;
    }
    setCargando(true);
    setError('');
    setResultado(null);
    try {
      const res = await fetch(`${API_BASE}/ImportarUsuarios.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: textoCsv }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'No se pudo importar el CSV.');
      } else {
        setResultado(data);
        onImportado?.(data);
      }
    } catch {
      setError('Error de conexión al importar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="modal activo" role="dialog" aria-modal="true" aria-label="Importar usuarios por CSV">
      <div className="formularios-body" style={{ maxWidth: 720, margin: '2rem auto', background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>📥 Importar usuarios por CSV</h2>
          <button type="button" className="btn-accion-tabla" onClick={cerrar} aria-label="Cerrar">✕</button>
        </div>

        <p className="ayuda-campo" style={{ marginTop: 10 }}>
          Solo superadmin. Se crea cada usuario <strong>activo</strong> con una <strong>contraseña temporal</strong>
          que debe cambiar luego en su cuenta. No se importan filas con correo repetido ni el rol superadmin.
        </p>

        <h3 style={{ fontSize: '0.98rem', margin: '1rem 0 0.4rem' }}>Formato de columnas</h3>
        <div className="contenedor-tabla" style={{ padding: 0, maxWidth: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Columna</th>
                <th>¿Obligatoria?</th>
                <th>Ejemplo / valores</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNAS.map((c) => (
                <tr key={c.nombre}>
                  <td><code>{c.nombre}</code></td>
                  <td>{c.req}</td>
                  <td>{c.ejemplo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: '0.75rem 0' }}>
          <button type="button" className="btn-agregar-par" onClick={descargarPlantilla}>
            ⬇️ Descargar plantilla CSV de ejemplo
          </button>
        </p>

        <div className="campo-formulario">
          <input type="file" accept=".csv,text/csv" onChange={alElegirArchivo} />
          {nombreArchivo && <span className="ayuda-campo">Archivo: {nombreArchivo}</span>}
        </div>

        <details style={{ margin: '0.5rem 0 1rem' }}>
          <summary style={{ cursor: 'pointer' }}>Pegar CSV a mano (opcional)</summary>
          <textarea
            value={textoCsv}
            onChange={(e) => { setTextoCsv(e.target.value); setNombreArchivo(''); }}
            rows={6}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
            placeholder="nombres,apellidos,correo,carrera,rol"
          />
        </details>

        {error && (
          <div className="alerta-duplicados" role="alert" style={{ marginBottom: 12 }}>
            <strong>⚠️</strong> {error}
          </div>
        )}

        {resultado && (
          <div className="caja-ayuda-botones-rec" style={{ marginBottom: 12 }}>
            <p>
              <strong>✅ {resultado.message}</strong>
            </p>
            {resultado.password_temporal && (
              <p>
                Contraseña temporal usada: <code>{resultado.password_temporal}</code>
                {' '}— comunícala a los usuarios y pídeles que la cambien.
              </p>
            )}
            {Array.isArray(resultado.errores) && resultado.errores.length > 0 && (
              <details open>
                <summary>Detalle ({resultado.errores.length})</summary>
                <ul>
                  {resultado.errores.map((e, i) => (
                    <li key={i}>Fila {e.fila}: {e.motivo}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-accion-tabla" onClick={cerrar}>Cerrar</button>
          <button
            type="button"
            className="btn-rec-primario btn-accion-tabla"
            onClick={importar}
            disabled={cargando}
            style={{ background: '#132740', color: '#fff', border: 'none', padding: '0.55rem 1rem', borderRadius: 8, cursor: cargando ? 'wait' : 'pointer' }}
          >
            {cargando ? 'Importando…' : 'Importar usuarios'}
          </button>
        </div>
      </div>
    </div>
  );
}
