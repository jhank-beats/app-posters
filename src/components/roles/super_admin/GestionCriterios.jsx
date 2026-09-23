import React, { useState, useEffect } from 'react';
import { FaTrashAlt } from "react-icons/fa";
import { FaRegPenToSquare } from "react-icons/fa6";
import "./Estilos.css";

const SERVER_URL = `http://${window.location.hostname}:8000`;

const GestionCriterios = ({ cerrarTabla }) => {
    const [criterios, setCriterios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [idEditando, setIdEditando] = useState(null);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [error, setError] = useState('');
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        cargarCriterios();
    }, []);

    const cargarCriterios = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${SERVER_URL}/api/Criterios.php`);
            const data = await res.json();
            if (data.success) setCriterios(data.data || []);
        } catch (err) {
            console.error("Error al cargar criterios:", err);
        } finally {
            setLoading(false);
        }
    };

    const abrirFormulario = (crit = null) => {
        setError('');
        if (crit) {
            setIdEditando(crit.id);
            setNombre(crit.nombre);
            setDescripcion(crit.descripcion || '');
        } else {
            setIdEditando(null);
            setNombre('');
            setDescripcion('');
        }
        setMostrarForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!nombre.trim()) {
            setError('El nombre del criterio es obligatorio');
            return;
        }

        try {
            const payload = { id: idEditando, nombre, descripcion };
            const res = await fetch(`${SERVER_URL}/api/Criterios.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                setNombre('');
                setDescripcion('');
                setIdEditando(null);
                setMostrarForm(false);
                cargarCriterios();
            } else {
                setError(data.message || 'Error al guardar el criterio');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión con el servidor');
        }
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Seguro de eliminar este criterio?')) return;
        try {
            const res = await fetch(`${SERVER_URL}/api/Criterios.php?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                cargarCriterios();
            } else {
                alert('❌ Error al eliminar: ' + (data.message || 'Ocurrió un problema'));
            }
        } catch (err) {
            console.error(err);
            alert('❌ Error de conexión al eliminar');
        }
    };

    const criteriosFiltrados = criterios.filter(crit =>
        crit.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        (crit.descripcion && crit.descripcion.toLowerCase().includes(filtro.toLowerCase()))
    );

    return (
        <div className="formularios" style={{ maxWidth: '850px', position: 'relative' }}>
            {/* Botón X posicionado correctamente adentro mediante .cerrar-formulario */}
            {cerrarTabla && (
                <button className="cerrar-formulario" onClick={cerrarTabla}>
                    X
                </button>
            )}

            <h2>⚙️ Configurar Criterios de Evaluación</h2>
            <p>Gestiona los criterios con los que se evaluarán los pósters.</p>

            <div className="contenedor-tabla">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Criterio</th>
                            <th>Descripción</th>
                            <th>Editar</th>
                            <th>Eliminar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: "center" }}>Cargando...</td>
                            </tr>
                        ) : criteriosFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: "center" }}>No hay criterios registrados</td>
                            </tr>
                        ) : (
                            criteriosFiltrados.map((crit) => (
                                <tr key={crit.id}>
                                    <td>{crit.id}</td>
                                    <td><strong>{crit.nombre}</strong></td>
                                    <td>{crit.descripcion || 'Sin descripción'}</td>
                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            onClick={() => abrirFormulario(crit)}
                                            title="Editar Criterio"
                                        >
                                            <FaRegPenToSquare />
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-rechazar"
                                            onClick={() => eliminar(crit.id)}
                                            title="Eliminar Criterio"
                                        >
                                            <FaTrashAlt />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                    className="boton-agregar-mas"
                    onClick={() => abrirFormulario()}
                >
                    + Agregar Criterio
                </button>

                <div className="filtros" style={{ marginTop: 0 }}>
                    <input
                        type="text"
                        placeholder="Buscar criterio..."
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        className="input-filtro"
                    />
                </div>
            </div>

            {/* Sub-modal emergente para crear/editar */}
            {mostrarForm && (
                <div className="modal">
                    <section className="formularios" style={{ maxWidth: '450px' }}>
                        <button
                            className="cerrar-formulario"
                            onClick={() => setMostrarForm(false)}
                        >
                            X
                        </button>

                        <h2>📝 {idEditando ? "Editar Criterio" : "Agregar Criterio"}</h2>

                        <form className="contenedor-formulario" onSubmit={handleSubmit}>
                            <input
                                type="text"
                                placeholder="🏷️ Nombre del criterio"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                required
                            />

                            <input
                                type="text"
                                placeholder="📄 Descripción (opcional)"
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                            />

                            <button className="solicitar-registro" type="submit">
                                {idEditando ? 'Guardar Cambios' : 'Guardar Criterio'}
                            </button>

                            {error && <p className="error-mensaje">{error}</p>}
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
};

export default GestionCriterios;