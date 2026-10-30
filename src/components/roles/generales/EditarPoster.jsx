import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../../config.js';
import BuscadorSelect from '../../generales/BuscadorSelect.jsx';
import "./roles.css";

// Nombres legibles de las categorías (mismas etiquetas que usa CargarPosters.jsx)
const ETIQUETAS_CATEGORIA = {
    desarrolloWeb: '💻 Desarrollo Web',
    programacion: '⚙️ Programación',
    backend: '🔧 Backend',
    frontend: '🎨 Frontend',
    calculo: '🧮 Cálculo/Ecuaciones',
    estadistica: '📊 Estadística'
};
const nombreCategoria = (valor) => ETIQUETAS_CATEGORIA[valor] || valor;
const MAX_DESCRIPCION = 255;

const EditarPoster = ({ poster, cerrarModal, alGuardarExitoso }) => {
    const [categorias, setCategorias] = useState([]);
    const [profesoresDisponibles, setProfesoresDisponibles] = useState([]);
    const [datosPoster, setDatosPoster] = useState({
        titulo: poster?.titulo || "",
        autores: poster?.autores || "",
        descripcion: poster?.descripcion || "",
        categoria: poster?.categoria || "",
        palabrasClave: poster?.palabras_clave || poster?.palabrasClave || ""
    });

    const [profesoresMaterias, setProfesoresMaterias] = useState(() => {
        if (Array.isArray(poster?.profesores) && poster.profesores.length > 0) {
            return poster.profesores.map(p => ({
                id_usuario: String(p.id_usuario || ""),
                materia: p.materia || ""
            }));
        }
        return [{ id_usuario: "", materia: "" }];
    });

    const [nuevoArchivo, setNuevoArchivo] = useState(null);
    const [cargandoGuardar, setCargandoGuardar] = useState(false);
    const [error, setError] = useState("");
    const [duplicadosDetectados, setDuplicadosDetectados] = useState([]);
    const [mensajeDuplicados, setMensajeDuplicados] = useState("");

    useEffect(() => {
        cargarCategorias();
        cargarProfesores();
    }, []);

    const cargarCategorias = async () => {
        try {
            const evCarrera = (poster?.evento_carrera || "").toLowerCase();
            const evNombre = (poster?.nombre_evento || poster?.carrera || "").toLowerCase();
            const cUsr = (localStorage.getItem("carreraUsuario") || "").toLowerCase();
            const carreraPoster = (evCarrera.includes("civil") || evNombre.includes("civil"))
                ? "civil"
                : (evCarrera.includes("sistema") || evNombre.includes("sistema"))
                ? "sistemas"
                : cUsr.includes("civil")
                ? "civil"
                : "sistemas";
            const respuesta = await fetch(`${API_BASE}/Categorias.php?carrera=${encodeURIComponent(carreraPoster)}`);
            const datos = await respuesta.json();
            if (datos.success) setCategorias(datos.data);
        } catch (err) {
            console.error("Error al cargar categorías en el modal:", err);
        }
    };

    const cargarProfesores = async () => {
        try {
            const respuesta = await fetch(`${API_BASE}/SubirPosters.php?action=profesores`);
            const datos = await respuesta.json();
            if (datos.success && Array.isArray(datos.data)) {
                setProfesoresDisponibles(datos.data);
            }
        } catch (err) {
            console.error("Error al cargar profesores en el modal:", err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setDatosPoster(prev => ({
            ...prev,
            [name]: value
        }));
        if ((name === "titulo" || name === "descripcion") && duplicadosDetectados.length > 0) {
            setDuplicadosDetectados([]);
        }
    };

    const actualizarParProfesor = (indice, campo, valor) => {
        setProfesoresMaterias(prev =>
            prev.map((par, i) => (i === indice ? { ...par, [campo]: valor } : par))
        );
    };

    const agregarParProfesor = () => {
        setProfesoresMaterias(prev => [...prev, { id_usuario: "", materia: "" }]);
    };

    const quitarParProfesor = (indice) => {
        setProfesoresMaterias(prev => {
            if (prev.length <= 1) return [{ id_usuario: "", materia: "" }];
            return prev.filter((_, i) => i !== indice);
        });
    };

    const guardarPoster = async (forzarGuardado = false) => {
        setError("");

        if (!datosPoster.titulo.trim()) {
            setError("El título no puede estar vacío");
            return;
        }

        if (datosPoster.descripcion.length > MAX_DESCRIPCION) {
            setError(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres (actual: ${datosPoster.descripcion.length}).`);
            return;
        }

        const filaIncompleta = profesoresMaterias.find(
            p => !p.id_usuario && p.materia.trim() !== ""
        );
        if (filaIncompleta) {
            setError("Selecciona el profesor asignado para cada materia ingresada.");
            return;
        }

        const paresValidos = profesoresMaterias
            .filter(p => p.id_usuario)
            .map(p => ({
                id_usuario: Number(p.id_usuario),
                materia: p.materia.trim()
            }));

        setCargandoGuardar(true);

        try {
            let respuesta;
            if (nuevoArchivo) {
                const formData = new FormData();
                formData.append('id', poster.id);
                formData.append('titulo', datosPoster.titulo.trim());
                formData.append('autores', datosPoster.autores.trim());
                formData.append('descripcion', datosPoster.descripcion.trim());
                formData.append('categoria', datosPoster.categoria);
                formData.append('palabrasClave', datosPoster.palabrasClave.trim());
                formData.append('archivo', nuevoArchivo);
                formData.append('forzar_guardado', forzarGuardado ? 'true' : 'false');
                paresValidos.forEach(p => {
                    formData.append('profesores[]', String(p.id_usuario));
                    formData.append('materias[]', p.materia);
                });
                formData.append('profesores_materias', JSON.stringify(paresValidos));

                respuesta = await fetch(`${API_BASE}/TablaPosters.php`, {
                    method: 'POST',
                    body: formData
                });
            } else {
                respuesta = await fetch(`${API_BASE}/TablaPosters.php`, {
                    method: 'PUT',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: poster.id,
                        titulo: datosPoster.titulo.trim(),
                        autores: datosPoster.autores.trim(),
                        descripcion: datosPoster.descripcion.trim(),
                        categoria: datosPoster.categoria,
                        palabrasClave: datosPoster.palabrasClave.trim(),
                        profesores: paresValidos.map(p => p.id_usuario),
                        materias: paresValidos.map(p => p.materia),
                        profesores_materias: paresValidos,
                        forzar_guardado: forzarGuardado
                    })
                });
            }

            const data = await respuesta.json();

            if (data.status === "duplicados") {
                setDuplicadosDetectados(Array.isArray(data.duplicados) ? data.duplicados : []);
                setMensajeDuplicados(data.message || "Se encontraron pósters similares en este evento.");
                return;
            }

            if (data.success) {
                alert("✅ Póster modificado correctamente");
                if (alGuardarExitoso) alGuardarExitoso();
                if (cerrarModal) cerrarModal();
            } else {
                setError(data.message || "Error al modificar el póster");
            }
        } catch (err) {
            console.error("❌ Error al modificar póster:", err);
            setError("Error al conectar con el servidor");
        } finally {
            setCargandoGuardar(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        guardarPoster(false);
    };

    return (
        <div className="modal">
            <section
                className="formularios formularios-editar"
                style={{ maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto' }}
            >
                {cerrarModal && (
                    <button className="cerrar-formulario" onClick={cerrarModal} type="button">X</button>
                )}

                <div className="formularios-header">
                    <span className="formularios-eyebrow">Edición</span>
                    <h2>📌 Editar Póster</h2>
                    <p>Actualiza la información técnica, profesores y materias del póster</p>
                </div>

                <form className="formularios-body" onSubmit={handleSubmit}>
                    <div className="campo-formulario">
                        <label className="etiqueta-campo">📝 Título del póster</label>
                        <input
                            type="text"
                            name="titulo"
                            value={datosPoster.titulo}
                            onChange={handleInputChange}
                            placeholder="Escribe el título"
                        />
                    </div>

                    <div className="campo-formulario">
                        <label className="etiqueta-campo">👥 Autores</label>
                        <input
                            type="text"
                            name="autores"
                            value={datosPoster.autores}
                            onChange={handleInputChange}
                            placeholder="Nombres de los autores"
                        />
                    </div>

                    <div className="campo-formulario">
                        <label className="etiqueta-campo">📁 Categoría</label>
                        <select
                            name="categoria"
                            value={datosPoster.categoria}
                            onChange={handleInputChange}
                        >
                            <option value="">Seleccione una categoría</option>
                            {categorias.map((cat) => (
                                <option key={cat.id_categorias} value={cat.nombre_categorias}>
                                    {nombreCategoria(cat.nombre_categorias)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="campo-formulario bloque-profesores-materias">
                        <div className="cabecera-profesores-materias">
                            <label className="etiqueta-campo">👨‍🏫 Profesores asignados y materias</label>
                            <span className="ayuda-campo">
                                Asigna uno o varios profesores y la materia correspondiente
                            </span>
                        </div>

                        <div className="lista-pares-profesores">
                            {profesoresMaterias.map((par, idx) => (
                                <div className="fila-profesor-materia" key={idx}>
                                    <BuscadorSelect
                                        items={profesoresDisponibles.map((prof) => ({
                                            value: prof.id,
                                            label: `${prof.nombre_completo || `${prof.nombres} ${prof.apellidos}`}${prof.carrera ? ` (${prof.carrera})` : ''}`,
                                        }))}
                                        value={par.id_usuario}
                                        onChange={(id) => actualizarParProfesor(idx, 'id_usuario', id)}
                                        placeholder="👨‍🏫 Busca el profesor por nombre..."
                                        emptyLabel="Sin resultados para esa búsqueda"
                                        aria-label={`Profesor ${idx + 1}`}
                                    />

                                    <input
                                        type="text"
                                        value={par.materia}
                                        onChange={(e) => actualizarParProfesor(idx, 'materia', e.target.value)}
                                        placeholder="📚 Materia / Asignatura"
                                        maxLength={160}
                                        aria-label={`Materia ${idx + 1}`}
                                    />

                                    {(profesoresMaterias.length > 1 || par.id_usuario || par.materia) && (
                                        <button
                                            type="button"
                                            className="btn-quitar-par"
                                            onClick={() => quitarParProfesor(idx)}
                                            title="Quitar fila"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            className="btn-agregar-par"
                            onClick={agregarParProfesor}
                        >
                            + Agregar otro profesor / materia
                        </button>
                    </div>

                    <div className="campo-formulario">
                        <label className="etiqueta-campo">📄 Descripción</label>
                        <textarea
                            name="descripcion"
                            value={datosPoster.descripcion}
                            maxLength={MAX_DESCRIPCION}
                            onChange={handleInputChange}
                            placeholder="Describe el póster (máx. 255 caracteres)"
                            rows="4"
                        ></textarea>
                        <div
                            className={`contador-caracteres ${
                                datosPoster.descripcion.length >= MAX_DESCRIPCION
                                    ? 'limite-alcanzado'
                                    : datosPoster.descripcion.length >= 220
                                    ? 'limite-cerca'
                                    : ''
                            }`}
                        >
                            {datosPoster.descripcion.length}/{MAX_DESCRIPCION} caracteres
                        </div>
                    </div>

                    <div className="campo-formulario">
                        <label className="etiqueta-campo">🏷️ Palabras clave</label>
                        <input
                            type="text"
                            name="palabrasClave"
                            value={datosPoster.palabrasClave}
                            onChange={handleInputChange}
                            placeholder="Ej: seguridad, visión artificial"
                        />
                    </div>

                    <div className="campo-formulario">
                        <label className="etiqueta-campo">📎 Archivo del póster (opcional)</label>
                        {poster?.imagen && (
                            <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 6px 0' }}>
                                Archivo actual: <strong>{poster.imagen}</strong>
                            </p>
                        )}
                        <input
                            type="file"
                            accept=".pdf, .png, .jpg, .jpeg"
                            onChange={(e) => setNuevoArchivo(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                        />
                        <span className="ayuda-campo" style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem', color: '#666' }}>
                            Formatos permitidos: PDF, PNG, JPG (máx. 10 MB). Deja este campo vacío si no deseas cambiar el archivo actual.
                        </span>
                    </div>

                    {duplicadosDetectados.length > 0 && (
                        <div className="alerta-duplicados" role="alert">
                            <div className="alerta-duplicados-cabecera">
                                <strong>⚠️ Posibles pósters duplicados detectados</strong>
                                <p>{mensajeDuplicados}</p>
                            </div>

                            <ul className="lista-duplicados">
                                {duplicadosDetectados.map((dup, idx) => (
                                    <li key={dup.id || idx} className="duplicado-item">
                                        <div className="duplicado-fila-top">
                                            <span className="duplicado-titulo">{dup.titulo}</span>
                                            <span className="duplicado-porcentaje">
                                                {dup.porcentaje ?? 100}% similitud
                                            </span>
                                        </div>
                                        <div className="duplicado-meta">
                                            <span><strong>Autor(es):</strong> {dup.autor || dup.autores || '—'}</span>
                                            {dup.motivo && (
                                                <span className="duplicado-motivo">{dup.motivo}</span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="acciones-duplicados">
                                <button
                                    type="button"
                                    className="boton-primario btn-forzar-guardado"
                                    disabled={cargandoGuardar}
                                    onClick={() => guardarPoster(true)}
                                >
                                    {cargandoGuardar ? "Guardando..." : "Guardar de todos modos"}
                                </button>
                                <button
                                    type="button"
                                    className="boton-secundario"
                                    disabled={cargandoGuardar}
                                    onClick={() => {
                                        setDuplicadosDetectados([]);
                                        setMensajeDuplicados("");
                                    }}
                                >
                                    Cancelar y corregir
                                </button>
                            </div>
                        </div>
                    )}

                    {error && <p className="error-mensaje">{error}</p>}

                    {duplicadosDetectados.length === 0 && (
                        <button className="boton-primario" type="submit" disabled={cargandoGuardar}>
                            {cargandoGuardar ? "Guardando..." : "Guardar Cambios"}
                        </button>
                    )}
                </form>
            </section>
        </div>
    );
};

export default EditarPoster;