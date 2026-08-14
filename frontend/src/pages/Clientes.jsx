import { useState } from 'react';
import Nav from '../components/Nav.jsx';
import { useRecurso } from '../hooks/useRecurso.js';

const FORMULARIO_VACIO = { id: null, nombre: '', email: '', telefono: '' };

// Las mismas reglas que valida clienteService en el backend.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar({ nombre, email }) {
  if (nombre.trim() === '') return 'El nombre es obligatorio';
  if (!RE_EMAIL.test(email)) return 'El email tiene formato inválido';
  return null;
}

export default function Clientes() {
  const { items: clientes, error, setError, crear, actualizar, darDeBaja } = useRecurso('/clientes');
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();

    const problema = validar(formulario);
    if (problema) {
      setError(problema);
      return; // ← acá se corta: la API no se llama.
    }

    const cuerpo = {
      nombre: formulario.nombre.trim(),
      email: formulario.email.trim(),
      telefono: formulario.telefono.trim()
    };

    const ok = formulario.id === null
      ? await crear(cuerpo)
      : await actualizar(formulario.id, cuerpo);

    if (ok) {
      setFormulario(FORMULARIO_VACIO);
    }
  }

  function editar(cliente) {
    setError('');
    setFormulario({
      id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono ?? ''
    });
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Clientes</h1>

        <form onSubmit={manejarSubmit}>
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            value={formulario.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            value={formulario.email}
            onChange={(e) => cambiar('email', e.target.value)}
          />

          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            value={formulario.telefono}
            onChange={(e) => cambiar('telefono', e.target.value)}
          />

          {error && <p role="alert" className="error">{error}</p>}

          <div>
            <button type="submit">Guardar</button>
            {formulario.id !== null && (
              <button type="button" onClick={() => setFormulario(FORMULARIO_VACIO)}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>{cliente.email}</td>
                <td>{cliente.telefono}</td>
                <td>
                  <button type="button" onClick={() => editar(cliente)}>Editar</button>
                  <button type="button" onClick={() => darDeBaja(cliente.id)}>Dar de baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
