import { useState } from 'react';
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
      <h1>Clientes</h1>

      <div className="card">
        <div className="card__header">
          {formulario.id === null ? 'Nuevo cliente' : `Editando #${formulario.id}`}
        </div>
        <div className="card__body">
          <form onSubmit={manejarSubmit}>
            <div className="campo--fila">
              <div className="campo">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  value={formulario.nombre}
                  onChange={(e) => cambiar('nombre', e.target.value)}
                />
              </div>

              <div className="campo">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  value={formulario.email}
                  onChange={(e) => cambiar('email', e.target.value)}
                />
              </div>

              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  id="telefono"
                  className="mono"
                  value={formulario.telefono}
                  onChange={(e) => cambiar('telefono', e.target.value)}
                />
              </div>
            </div>

            {error && <p role="alert" className="error">{error}</p>}

            <div className="acciones-form">
              <button type="submit" className="btn--primary">Guardar</button>
              {formulario.id !== null && (
                <button type="button" onClick={() => setFormulario(FORMULARIO_VACIO)}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        {clientes.length === 0 ? (
          <div className="estado-vacio">
            <strong>No hay clientes cargados</strong>
            <span>Creá el primero con el formulario de arriba.</span>
          </div>
        ) : (
          <div className="tabla-scroll">
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
                    <td className="num">{cliente.telefono}</td>
                    <td>
                      <div className="acciones-form">
                        <button type="button" onClick={() => editar(cliente)}>Editar</button>
                        <button type="button" className="btn--danger" onClick={() => darDeBaja(cliente.id)}>Dar de baja</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
