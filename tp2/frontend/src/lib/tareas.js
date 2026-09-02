// Lógica pura del frontend: sin React, sin fetch, sin DOM.
// Es lo que los unit tests del pipeline verifican sin necesidad de jsdom.

export const LARGO_MAXIMO = 100

/**
 * Valida el título de una tarea antes de enviarlo a la API.
 * (La API vuelve a validar en el backend: el front valida por UX,
 * el back por seguridad — ninguno confía en el otro.)
 */
export function validarTitulo(titulo) {
  const normalizado = (titulo ?? '').trim()
  if (normalizado === '') {
    return { valido: false, error: 'El título es obligatorio.' }
  }
  if (normalizado.length > LARGO_MAXIMO) {
    return { valido: false, error: `El título no puede superar los ${LARGO_MAXIMO} caracteres.` }
  }
  return { valido: true, titulo: normalizado }
}

/**
 * Ordena las tareas de más nueva a más vieja (por fecha de creación,
 * con el id como desempate). No muta el array original.
 */
export function ordenarTareas(tareas) {
  return [...tareas].sort((a, b) => {
    const porFecha = new Date(b.creadaEl) - new Date(a.creadaEl)
    return porFecha !== 0 ? porFecha : b.id - a.id
  })
}
