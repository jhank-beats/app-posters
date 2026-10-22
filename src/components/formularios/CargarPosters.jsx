import './Formulario.css'
import { useState, useEffect } from 'react'
import { API_BASE } from '../../config.js'
import BuscadorSelect from '../generales/BuscadorSelect.jsx'

const CATEGORIAS_RESPALDO = [
  { id_categorias: 1, nombre_categorias: 'desarrolloWeb' },
  { id_categorias: 2, nombre_categorias: 'programacion' },
  { id_categorias: 3, nombre_categorias: 'backend' },
  { id_categorias: 4, nombre_categorias: 'frontend' },
  { id_categorias: 5, nombre_categorias: 'calculo' },
  { id_categorias: 6, nombre_categorias: 'estadistica' },
]

const ETIQUETAS_CATEGORIA = {
  desarrolloWeb: '💻 Desarrollo Web',
  programacion: '⚙️ Programación',
  backend: '🔧 Backend',
  frontend: '🎨 Frontend',
  calculo: '🧮 Cálculo/Ecuaciones',
  estadistica: '📊 Estadística',
}

const nombreCategoriaLegible = (valor) => ETIQUETAS_CATEGORIA[valor] || valor

const MAX_DESCRIPCION = 255

const CargarPoster = ({ onPosterUpload, cerrarModal }) => {
  const [titulo, setTitulo] = useState('')
  const [autores, setAutores] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [palabrasClave, setPalabrasClave] = useState('')
  const [archivo, setArchivo] = useState(null)

  const carreraGuardada = (localStorage.getItem('carreraUsuario') || '').toLowerCase()
  const carreraInicial = carreraGuardada.includes('civil') ? 'civil' : 'sistemas'

  const [carreraParticipacion, setCarreraParticipacion] = useState(carreraInicial)
  const [eventosPorCarrera, setEventosPorCarrera] = useState({ sistemas: null, civil: null })
  const [categoriasDisponibles, setCategoriasDisponibles] = useState(CATEGORIAS_RESPALDO)
  const [profesoresDisponibles, setProfesoresDisponibles] = useState([])
  const [profesoresMaterias, setProfesoresMaterias] = useState([
    { id_usuario: '', materia: '' },
  ])

  const [errorMensaje, setErrorMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [duplicadosDetectados, setDuplicadosDetectados] = useState([])
  const [mensajeDuplicados, setMensajeDuplicados] = useState('')

  useEffect(() => {
    cargarCategorias()
    cargarProfesores()
    cargarEventosActivos()
  }, [])

  const cargarEventosActivos = async () => {
    try {
      const res = await fetch(`${API_BASE}/Eventos.php?activo=1`)
      const datos = await res.json()
      if ((datos.status === 'success' || datos.success) && datos.por_carrera) {
        setEventosPorCarrera(datos.por_carrera)
      }
    } catch (err) {
      console.error('Error al cargar eventos activos:', err)
    }
  }

  const cargarCategorias = async () => {
    try {
      const res = await fetch(`${API_BASE}/Categorias.php`)
      const datos = await res.json()
      if (datos.success && Array.isArray(datos.data) && datos.data.length > 0) {
        setCategoriasDisponibles(datos.data)
      }
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    }
  }

  const cargarProfesores = async () => {
    try {
      const res = await fetch(`${API_BASE}/SubirPosters.php?action=profesores`)
      const datos = await res.json()
      if (datos.success && Array.isArray(datos.data)) {
        setProfesoresDisponibles(datos.data)
      }
    } catch (err) {
      console.error('Error al cargar lista de profesores:', err)
    }
  }

  const actualizarParProfesor = (indice, campo, valor) => {
    setProfesoresMaterias((prev) =>
      prev.map((par, i) => (i === indice ? { ...par, [campo]: valor } : par))
    )
  }

  const agregarParProfesor = () => {
    setProfesoresMaterias((prev) => [...prev, { id_usuario: '', materia: '' }])
  }

  const quitarParProfesor = (indice) => {
    setProfesoresMaterias((prev) => {
      if (prev.length <= 1) {
        return [{ id_usuario: '', materia: '' }]
      }
      return prev.filter((_, i) => i !== indice)
    })
  }

  const enviarPoster = async (forzarGuardado = false) => {
    setErrorMensaje('')

    const idUsuario = localStorage.getItem('idUsuario') || localStorage.getItem('id_usuario')
    if (!idUsuario) {
      alert('⚠️ Error: No has iniciado sesión. No puedes subir un póster.')
      return
    }

    if (
      !titulo.trim() ||
      !autores.trim() ||
      !descripcion.trim() ||
      !categoria ||
      !palabrasClave.trim() ||
      !archivo
    ) {
      setErrorMensaje('Por favor, completa todos los campos obligatorios del póster.')
      return
    }

    if (descripcion.length > MAX_DESCRIPCION) {
      setErrorMensaje(
        `La descripción no puede superar los ${MAX_DESCRIPCION} caracteres (actual: ${descripcion.length}).`
      )
      return
    }

    // Validar que si se escribió una materia se haya elegido el profesor correspondiente
    const filaIncompleta = profesoresMaterias.find(
      (p) => !p.id_usuario && p.materia.trim() !== ''
    )
    if (filaIncompleta) {
      setErrorMensaje('Selecciona el profesor asignado para cada materia ingresada.')
      return
    }

    const paresValidos = profesoresMaterias
      .filter((p) => p.id_usuario)
      .map((p) => ({
        id_usuario: Number(p.id_usuario),
        materia: p.materia.trim(),
      }))

    const formData = new FormData()
    formData.append('titulo', titulo.trim())
    formData.append('autores', autores.trim())
    formData.append('descripcion', descripcion.trim())
    formData.append('categoria', categoria)
    formData.append('palabrasClave', palabrasClave.trim())
    formData.append('archivo', archivo)
    formData.append('id_usuario', idUsuario)
    formData.append('carrera_participacion', carreraParticipacion)
    formData.append('forzar_guardado', forzarGuardado ? 'true' : 'false')

    paresValidos.forEach((par) => {
      formData.append('profesores[]', String(par.id_usuario))
      formData.append('materias[]', par.materia)
    })
    formData.append('profesores_materias', JSON.stringify(paresValidos))

    try {
      setEnviando(true)
      const response = await fetch(`${API_BASE}/SubirPosters.php`, {
        method: 'POST',
        body: formData,
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        alert('⚠️ El servidor no devolvió JSON válido. Revisa la consola.')
        return
      }

      if (data.status === 'duplicados') {
        setDuplicadosDetectados(Array.isArray(data.duplicados) ? data.duplicados : [])
        setMensajeDuplicados(
          data.message ||
            'Se encontraron pósters con título, descripción o archivo muy similares.'
        )
        return
      }

      if (data.status === 'success' || data.success) {
        const evalAsignados = data.poster?.evaluadores_asignados || []
        const detalleEval =
          evalAsignados.length > 0
            ? `\n🎯 Evaluador asignado automáticamente: ${evalAsignados.map((ev) => ev.nombre).join(', ')}`
            : ''
        alert('✅ ' + (data.message || 'Póster registrado exitosamente') + detalleEval)

        setTitulo('')
        setAutores('')
        setDescripcion('')
        setCategoria('')
        setPalabrasClave('')
        setArchivo(null)
        setProfesoresMaterias([{ id_usuario: '', materia: '' }])
        setDuplicadosDetectados([])
        setMensajeDuplicados('')

        if (onPosterUpload) onPosterUpload(data.poster)
        if (cerrarModal) cerrarModal()
      } else {
        setErrorMensaje(data.message || 'Error al registrar el póster.')
      }
    } catch (err) {
      console.error('Error al subir el póster:', err)
      setErrorMensaje('Error al conectar con el servidor.')
    } finally {
      setEnviando(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    enviarPoster(false)
  }

  const esRolEvaluador =
    parseInt(localStorage.getItem('id_rol') || '0', 10) === 2 ||
    (localStorage.getItem('rol') || '').toLowerCase() === 'evaluador'

  const contenido = (
    <>
      {cerrarModal && (
        <button className="cerrar-formulario" onClick={cerrarModal} type="button">
          X
        </button>
      )}

      <div className="formularios-header">
        <span className="formularios-eyebrow">Subir Póster</span>
        <h2>🖼️ Publica tu Trabajo</h2>
        <p>Completa los datos para subir tu póster y asignar profesores/materias</p>
        {esRolEvaluador && (
          <small style={{ display: 'block', marginTop: '0.35rem', color: '#00acc9', fontWeight: 600 }}>
            ℹ️ Al publicar desde tu perfil de evaluador, tu póster será asignado a otros evaluadores (no podrás autoevaluarte).
          </small>
        )}
      </div>

      <form
        className="formularios-body"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        <div className="campo-formulario">
          <input
            type="text"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              if (duplicadosDetectados.length > 0) setDuplicadosDetectados([])
            }}
            placeholder="📌 Título del Póster"
            required
          />
        </div>

        <div className="campo-formulario">
          <input
            type="text"
            value={autores}
            onChange={(e) => setAutores(e.target.value)}
            placeholder="👥 Autores del Póster"
            required
          />
        </div>

        <div className="campo-formulario">
          <textarea
            value={descripcion}
            maxLength={MAX_DESCRIPCION}
            onChange={(e) => {
              setDescripcion(e.target.value)
              if (duplicadosDetectados.length > 0) setDuplicadosDetectados([])
            }}
            placeholder="📝 Descripción del Póster (máximo 255 caracteres)"
            required
          />
          <div
            className={`contador-caracteres ${
              descripcion.length >= MAX_DESCRIPCION
                ? 'limite-alcanzado'
                : descripcion.length >= 220
                ? 'limite-cerca'
                : ''
            }`}
          >
            {descripcion.length}/{MAX_DESCRIPCION} caracteres
          </div>
        </div>

        <div className="campo-formulario">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            required
          >
            <option value="">📂 Selecciona la Categoría</option>
            {categoriasDisponibles.map((cat) => (
              <option key={cat.id_categorias} value={cat.nombre_categorias}>
                {nombreCategoriaLegible(cat.nombre_categorias)}
              </option>
            ))}
          </select>
        </div>

        <div className="campo-formulario">
          <select
            value={carreraParticipacion}
            onChange={(e) => setCarreraParticipacion(e.target.value)}
            required
            aria-label="Carrera o evento en el que participa el póster"
          >
            <option value="sistemas">
              💻 Ingeniería de Sistemas
              {eventosPorCarrera.sistemas ? ` — ${eventosPorCarrera.sistemas.nombre_evento}` : ''}
            </option>
            <option value="civil">
              🏗️ Ingeniería Civil
              {eventosPorCarrera.civil ? ` — ${eventosPorCarrera.civil.nombre_evento}` : ''}
            </option>
            <option value="ambas">
              🤝 Ambas carreras (Ingeniería de Sistemas e Ingeniería Civil)
            </option>
          </select>
          <span className="ayuda-campo">
            Elige si el póster participa en el evento de Ingeniería de Sistemas, Ingeniería Civil o en ambos
          </span>
        </div>

        {/* Profesores y materias (soporta 1 o varias materias por póster) */}
        <div className="campo-formulario bloque-profesores-materias">
          <div className="cabecera-profesores-materias">
            <label>👨‍🏫 Profesores asignados y materias</label>
            <span className="ayuda-campo">
              Puedes asociar uno o varios profesores si el póster aplica para dos materias
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
                    aria-label="Quitar profesor y materia"
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
          <input
            type="text"
            value={palabrasClave}
            onChange={(e) => setPalabrasClave(e.target.value)}
            placeholder="🔑 Palabras Clave"
            required
          />
        </div>

        <div className="campo-formulario">
          <input
            type="file"
            onChange={(e) => {
              setArchivo(e.target.files[0])
              if (duplicadosDetectados.length > 0) setDuplicadosDetectados([])
            }}
            accept=".pdf,.jpg,.jpeg,.png"
            required
          />
          <span className="ayuda-campo">
            Archivo digital del póster: PDF, JPG o PNG · máximo 10 MB. En celular, busca el profesor escribiendo sus primeras letras.
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
                    <span>
                      <strong>Autor(es):</strong> {dup.autor || dup.autores || '—'}
                    </span>
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
                disabled={enviando}
                onClick={() => enviarPoster(true)}
              >
                {enviando ? 'Subiendo...' : 'Subir de todos modos'}
              </button>
              <button
                type="button"
                className="boton-secundario"
                disabled={enviando}
                onClick={() => {
                  setDuplicadosDetectados([])
                  setMensajeDuplicados('')
                }}
              >
                Cancelar y corregir
              </button>
            </div>
          </div>
        )}

        {errorMensaje && <p className="error-mensaje">{errorMensaje}</p>}

        {duplicadosDetectados.length === 0 && (
          <button className="boton-primario" type="submit" disabled={enviando}>
            {enviando ? 'Subiendo póster...' : 'Subir Póster'}
          </button>
        )}

        <div className="formatos-aceptados-info" aria-label="Formatos de archivo aceptados">
          <span className="formatos-aceptados-titulo">
            📎 Formatos aceptados en la plataforma:
          </span>
          <div className="formatos-aceptados-badges">
            <span className="badge-formato">📄 PDF (.pdf)</span>
            <span className="badge-formato">🖼️ PNG (.png)</span>
            <span className="badge-formato">🖼️ JPG / JPEG (.jpg, .jpeg)</span>
          </div>
        </div>
      </form>
    </>
  )

  // Modo modal (desde HomePageUsuario / HomePageEvaluador): tarjeta centrada
  if (cerrarModal) {
    return (
      <div
        className="formularios formulario-cargar-poster"
        style={{ maxWidth: '620px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {contenido}
      </div>
    )
  }
  // Modo página standalone (/CargarPosters): centrado en la página
  return (
    <section className="formularios-page">
      <div className="formularios formulario-cargar-poster" style={{ maxWidth: '620px' }}>
        {contenido}
      </div>
    </section>
  )
}

export default CargarPoster
