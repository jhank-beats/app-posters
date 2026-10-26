import React, { useState } from 'react';
import { API_BASE } from '../../../config.js';
import './roles.css';

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
    <div className="modal" role="dialog" aria-modal="true" aria-label="Importar usuarios por CSV">
      <section className="formularios" style={{ maxWidth: '720px', width: '100%' }}>
        {cerrar && (
          <button className="cerrar-formulario" onClick={cerrar} aria-label="Cerrar">
            X
          </button>
        )}

        <div className="formularios-header">
          <span className="formularios-eyebrow">Carga masiva</span>
          <h2>📥 Importar usuarios por CSV</h2>
          <p>
            Crea usuarios activos de forma masiva con una contraseña aleatoria generada automáticamente.
            El sistema enviará un correo a cada usuario con su contraseña y el recordatorio de cambiarla por seguridad.
          </p>
        </div>

        <div className="formularios-body">
          <p className="ayuda-campo">
            No se importan correos repetidos ni el rol superadmin. Formato del archivo: filas
            con encabezados de columna en la primera línea. Si importas como Administrador de carrera,
            los usuarios se vincularán automáticamente a tu carrera y evento activo.
          </p>

          <div className="campo-formulario">
            <label className="etiqueta-campo" style={{ display: 'block', marginBottom: 6 }}>
              📋 Formato de columnas
            </label>
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
          </div>

          <div className="campo-formulario" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="boton-primario" onClick={descargarPlantilla}>
              ⬇️ Descargar plantilla CSV
            </button>
          </div>

          <div className="campo-formulario">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={alElegirArchivo}
            />
            {nombreArchivo && (
              <span className="ayuda-campo">Archivo: {nombreArchivo}</span>
            )}
          </div>

          <details style={{ margin: '0.5rem 0 1rem' }}>
            <summary style={{ cursor: 'pointer' }}>Pegar CSV a mano (opcional)</summary>
            <div className="campo-formulario">
              <textarea
                value={textoCsv}
                onChange={(e) => {
                  setTextoCsv(e.target.value);
                  setNombreArchivo('');
                }}
                rows={6}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  marginTop: 8,
                  padding: '0.55rem 0.75rem',
                  border: '1px solid #c5cdd8',
                  borderRadius: 8,
                }}
                placeholder="nombres,apellidos,correo,carrera,rol"
              />
            </div>
          </details>

          {error && <p className="error-mensaje">{error}</p>}

          {resultado && (
            <div className="caja-ayuda-botones-rec" style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>✅ {resultado.message}</strong>
              </p>
              {resultado.correos_enviados !== undefined && (
                <p style={{ margin: '0 0 0.5rem' }}>
                  📧 Se enviaron <strong>{resultado.correos_enviados}</strong> correo(s) con la contraseña generada y el recordatorio de cambiarla por seguridad.
                </p>
              )}
              {resultado.password_temporal && (
                <p style={{ margin: '0 0 0.5rem' }}>
                  Contraseña temporal de respaldo: <code>{resultado.password_temporal}</code>
                  {' '}— cada usuario también recibió su contraseña en su correo electrónico.
                </p>
              )}
              {Array.isArray(resultado.errores) && resultado.errores.length > 0 && (
                <details open>
                  <summary>Detalle ({resultado.errores.length})</summary>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                    {resultado.errores.map((e, i) => (
                      <li key={i}>Fila {e.fila}: {e.motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="boton-primario"
              onClick={importar}
              disabled={cargando}
            >
              {cargando ? 'Importando…' : 'Importar usuarios'}
            </button>
            <button type="button" className="boton-secundario" onClick={cerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
