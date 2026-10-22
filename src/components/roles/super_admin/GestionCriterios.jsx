import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import "../generales/roles.css";
import "../../formularios/Formulario.css";
import { obtenerRondasResumen } from '../../../api/rondasResumen.js';
import { API_BASE } from '../../../config.js';
import HintScrollTabla from '../../generales/HintScrollTabla.jsx';


const GestionCriterios = ({ cerrarTabla }) => {
    const [criterios, setCriterios] = useState([]);
    const [rondas, setRondas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [idRonda, setIdRonda] = useState(1);
    const [filtroRonda, setFiltroRonda] = useState('');
    const [idEditando, setIdEditando] = useState(null);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [error, setError] = useState('');
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        cargarRondas();
        cargarCriterios();
    }, []);

    const cargarRondas = async () => {
        try {
            const data = await obtenerRondasResumen();
            if (data.success) {
                const lista = [];
                (data.data || []).forEach(ev => {
                    (ev.rondas || []).forEach(r => {
                        lista.push({
                            id_ronda: r.id_ronda,
                            numero: r.numero,
                            nombre: r.nombre,
                            nombre_evento: ev.nombre_evento
                        });
                    });
                });
                setRondas(lista);
            }
        } catch (err) {
            console.error("Error al cargar rondas:", err);
        }
    };

    const cargarCriterios = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/Criterios.php`);
            const data = await res.json();
            if (data.success) setCriterios(data.data || []);
        } catch (err) {
            console.error("Error al cargar criterios:", err);
        } finally { setLoading(false); }
    };

    const nombreRonda = (id) => {
        const ronda = rondas.find(r => String(r.id_ronda) === String(id));
        return ronda ? `Ronda ${ronda.numero}` : `Ronda ${id}`;
    };

    const abrirFormulario = (crit = null) => {
        setError('');
        if (crit) {
            setIdEditando(crit.id);
            setNombre(crit.nombre);
            setDescripcion(crit.descripcion || '');
            setIdRonda(crit.id_ronda || 1);
        } else {
            setIdEditando(null);
            setNombre('');
            setDescripcion('');
            setIdRonda(filtroRonda ? parseInt(filtroRonda, 10) : (rondas[0]?.id_ronda || 1));
        }
        setMostrarForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!nombre.trim()) { setError('El nombre del criterio es obligatorio'); return; }
        try {
            const payload = { id: idEditando, nombre, descripcion, id_ronda: idRonda };
            const res = await fetch(`${API_BASE}/Criterios.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.success) {
                setNombre(''); setDescripcion(''); setIdEditando(null); setMostrarForm(false); cargarCriterios();
            } else setError(data.message || 'Error al guardar el criterio');
        } catch { setError('Error de conexión con el servidor'); }
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Seguro de eliminar este criterio?')) return;
        try {
            const res = await fetch(`${API_BASE}/Criterios.php?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) cargarCriterios();
            else alert('❌ No se puede eliminar: ' + (data.message || 'el criterio ya tiene evaluaciones registradas'));
        } catch { alert('❌ Error de conexión al eliminar'); }
    };

    const criteriosFiltrados = criterios.filter(crit => {
        const coincideTexto = crit.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
            (crit.descripcion && crit.descripcion.toLowerCase().includes(filtro.toLowerCase()));
        const coincideRonda = !filtroRonda || String(crit.id_ronda) === String(filtroRonda);
        return coincideTexto && coincideRonda;
    });

    return (
        <div className="formularios" style={{ maxWidth: '800px' }}>
            {cerrarTabla && (<button className="cerrar-formulario" onClick={cerrarTabla} aria-label="Cerrar">X</button>)}
            <div className="formularios-header">
                <span className="formularios-eyebrow">Parametrización</span>
                <h2>⚙️ Configurar Criterios de Evaluación</h2>
                <p>Gestiona los criterios con los que se evaluarán los pósters.</p>
            </div>

            {/* El cuerpo scrollea dentro del modal (el header con la X y los
                botones se quedan fijos y siempre visibles). */}
            <div className="formularios-body">
                <div className="contenedor-tabla">
                  <HintScrollTabla />
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Ronda</th>
                                <th>Criterio</th>
                                <th>Descripción</th>
                                <th>Editar</th>
                                <th>Eliminar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: "center" }}>Cargando...</td></tr>
                            ) : criteriosFiltrados.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: "center" }}>No hay criterios registrados</td></tr>
                            ) : (
                                criteriosFiltrados.map((crit) => (
                                    <tr key={crit.id}>
                                        <td>{crit.id}</td>
                                        <td><span className="badge-rol rol-4">{nombreRonda(crit.id_ronda)}</span></td>
                                        <td><strong>{crit.nombre}</strong></td>
                                        <td>{crit.descripcion || 'Sin descripción'}</td>
                                        <td><button className="btn-rechazar" onClick={() => abrirFormulario(crit)} title="Editar Criterio"><FaRegPenToSquare /></button></td>
                                        <td><button className="btn-rechazar" onClick={() => eliminar(crit.id)} title="Eliminar Criterio"><FaTrashAlt /></button></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <button className="boton-primario" onClick={() => abrirFormulario()}>+ Agregar Criterio</button>
                    <div className="filtros" style={{ margin: 0, padding: 0 }}>
                        <input type="text" placeholder="Buscar criterio..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                        <select value={filtroRonda} onChange={(e) => setFiltroRonda(e.target.value)} aria-label="Filtrar por ronda">
                            <option value="">Todas las rondas</option>
                            {rondas.map(r => (
                                <option key={r.id_ronda} value={r.id_ronda}>Ronda {r.numero} · {r.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {mostrarForm && (
                <div className="modal">
                    <div className="formularios" style={{ maxWidth: '450px' }}>
                        <button className="cerrar-formulario" onClick={() => setMostrarForm(false)} aria-label="Cerrar">X</button>
                        <div className="formularios-header">
                            <span className="formularios-eyebrow">{idEditando ? "Edición" : "Nuevo"}</span>
                            <h2>📝 {idEditando ? "Editar Criterio" : "Agregar Criterio"}</h2>
                        </div>
                        <form className="formularios-body" onSubmit={handleSubmit}>
                            <div className="campo-formulario">
                                <select value={idRonda} onChange={(e) => setIdRonda(parseInt(e.target.value, 10))} aria-label="Ronda del criterio">
                                    {rondas.map(r => (
                                        <option key={r.id_ronda} value={r.id_ronda}>Ronda {r.numero} · {r.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="campo-formulario"><input type="text" placeholder="🏷️ Nombre del criterio" value={nombre} onChange={(e) => setNombre(e.target.value)} required /></div>
                            <div className="campo-formulario"><input type="text" placeholder="📄 Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
                            <p style={{ fontSize: '0.82rem', color: '#5f5e5e', margin: '0 0 0.75rem' }}>
                                Cada criterio pertenece a una ronda. Un criterio con evaluaciones registradas no se
                                puede eliminar, para no perder el histórico de notas.
                            </p>
                            <button className="boton-primario" type="submit">{idEditando ? 'Guardar Cambios' : 'Guardar Criterio'}</button>
                            {error && <p className="error-mensaje">{error}</p>}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionCriterios;
