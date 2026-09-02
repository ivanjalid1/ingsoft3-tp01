import { useEffect, useState } from 'react'
import { ordenarTareas, validarTitulo } from './lib/tareas.js'

// Misma URL en dev y en contenedor: en dev la proxea Vite (vite.config.js),
// en el contenedor la proxea nginx (nginx.conf). El browser siempre ve same-origin.
const API = '/api/tareas'

export default function App() {
  const [tareas, setTareas] = useState([])
  const [titulo, setTitulo] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargarTareas() {
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTareas(await res.json())
      setError(null)
    } catch (e) {
      setError(`No se pudo conectar con la API (${e.message}). ¿Está levantado el backend?`)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarTareas()
  }, [])

  async function agregarTarea(e) {
    e.preventDefault()
    const validacion = validarTitulo(titulo)
    if (!validacion.valido) {
      setError(validacion.error)
      return
    }
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: validacion.titulo }),
    })
    if (res.ok) {
      setTitulo('')
      setError(null)
      await cargarTareas()
    } else {
      const cuerpo = await res.json().catch(() => null)
      setError(cuerpo?.error ?? `La API rechazó la tarea (HTTP ${res.status}).`)
    }
  }

  async function borrarTarea(id) {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
    if (res.ok) await cargarTareas()
  }

  return (
    <main className="app">
      <h1>Tareas</h1>
      <p className="subtitulo">
        Sample de la cátedra — Ingeniería del Software 3 · UCC
      </p>

      <form onSubmit={agregarTarea} className="alta">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nueva tarea…"
          aria-label="Título de la nueva tarea"
        />
        <button type="submit">Agregar</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <ul className="lista">
          {ordenarTareas(tareas).map((t) => (
            <li key={t.id}>
              <span>{t.titulo}</span>
              <button onClick={() => borrarTarea(t.id)} aria-label={`Borrar ${t.titulo}`}>
                ✕
              </button>
            </li>
          ))}
          {tareas.length === 0 && <li className="vacia">Sin tareas todavía.</li>}
        </ul>
      )}
    </main>
  )
}
