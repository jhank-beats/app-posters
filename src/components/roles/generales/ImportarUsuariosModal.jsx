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
  const [copiadoIdx, setCopiadoIdx] = useState(null);
  const [copiadoTodo, setCopiadoTodo] = useState(false);

  const copiarClave = (password, idx) => {
    navigator.clipboard?.writeText(password);
    setCopiadoIdx(idx);
    setTimeout(() => setCopiadoIdx(null), 2000);
  };

  const copiarTodo = () => {
    if (!resultado?.usuarios_creados) return;
    const txt = resultado.usuarios_creados
      .map((u) => `${u.nombre} | ${u.correo} | Contraseña: ${u.password}`)
      .join('\n');
    navigator.clipboard?.writeText(txt);
    setCopiadoTodo(true);
    setTimeout(() => setCopiadoTodo(false), 2500);
  };

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
            <div className="caja-ayuda-botones-rec" style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#166534' }}>
                <strong>✅ {resultado.message}</strong>
              </p>
              {resultado.correos_enviados !== undefined && (
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#374151' }}>
                  📧 Se enviaron <strong>{resultado.correos_enviados}</strong> correo(s) con la contraseña generada a cada usuario y la recomendación de seguridad para cambiarla en su primer ingreso.
                </p>
              )}

              {/* Lista estética de credenciales generadas por usuario */}
              {Array.isArray(resultado.usuarios_creados) && resultado.usuarios_creados.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    marginBottom: 12,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 10,
                      paddingBottom: 8,
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>
                      🔑 Contraseñas generadas por usuario ({resultado.usuarios_creados.length})
                    </span>
                    <button
                      type="button"
                      onClick={copiarTodo}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#0369a1',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiadoTodo ? '✓ ¡Copiadas al portapapeles!' : '📋 Copiar todas'}
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingRight: 4,
                    }}
                  >
                    {resultado.usuarios_creados.map((u, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          padding: '8px 10px',
                          background: '#f8fafc',
                          borderRadius: 6,
                          border: '1px solid #edf2f7',
                        }}
                      >
                        <div style={{ minWidth: 200, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                            {u.nombre}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {u.correo} <span style={{ opacity: 0.6 }}>•</span> {u.rol}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: '#0f766e',
                              letterSpacing: '0.5px',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            {u.password}
                          </code>
                          <button
                            type="button"
                            onClick={() => copiarClave(u.password, idx)}
                            title="Copiar contraseña"
                            style={{
                              padding: '3px 7px',
                              fontSize: '0.75rem',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 4,
                              cursor: 'pointer',
                              color: copiadoIdx === idx ? '#166534' : '#475569',
                            }}
                          >
                            {copiadoIdx === idx ? '✓ Copiado' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                    * Guarda o comparte estas contraseñas si el destinatario no tiene acceso inmediato a su correo institucional.
                  </p>
                </div>
              )}

              {resultado.password_temporal && !resultado.usuarios_creados && (
                <p style={{ margin: '0 0 0.5rem' }}>
                  Contraseña temporal: <code>{resultado.password_temporal}</code>
                </p>
              )}

              {Array.isArray(resultado.errores) && resultado.errores.length > 0 && (
                <details open style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#b91c1c' }}>
                    Detalle de filas no importadas ({resultado.errores.length})
                  </summary>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', color: '#b91c1c', fontSize: '0.85rem' }}>
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
