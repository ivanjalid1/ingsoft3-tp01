import { useState } from 'react';
import Nav from '../components/Nav.jsx';
import { useRecurso } from '../hooks/useRecurso.js';

const FORMULARIO_VACIO = { id: null, nombre: '', precio: '', stock: '' };

// Las MISMAS reglas que valida productoService en el backend.
// Duplicarlas es intencional: acá para dar feedback inmediato, allá porque
// el backend es la única frontera confiable.
function validar({ nombre, precio, stock }) {
  if (nombre.trim() === '') return 'El nombre es obligatorio';
  const precioNumero = Number(precio);
  if (precio === '' || Number.isNaN(precioNumero) || precioNumero <= 0) {
    return 'El precio debe ser mayor a cero';
  }
  const stockNumero = Number(stock);
  if (stock === '' || !Number.isInteger(stockNumero) || stockNumero < 0) {
    return 'El stock debe ser un entero mayor o igual a cero';
  }
  return null;
}

export default function Productos() {
  const { items: productos, error, setError, crear, actualizar, darDeBaja } = useRecurso('/productos');
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
      precio: Number(formulario.precio),
      stock: Number(formulario.stock)
    };

    const ok = formulario.id === null
      ? await crear(cuerpo)
      : await actualizar(formulario.id, cuerpo);

    if (ok) {
      setFormulario(FORMULARIO_VACIO);
    }
  }

  function editar(producto) {
    setError('');
    setFormulario({
      id: producto.id,
      nombre: producto.nombre,
      precio: String(producto.precio),
      stock: String(producto.stock)
    });
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Productos</h1>

        <form onSubmit={manejarSubmit}>
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            value={formulario.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
          />

          <label htmlFor="precio">Precio</label>
          <input
            id="precio"
            value={formulario.precio}
            onChange={(e) => cambiar('precio', e.target.value)}
          />

          <label htmlFor="stock">Stock</label>
          <input
            id="stock"
            value={formulario.stock}
            onChange={(e) => cambiar('stock', e.target.value)}
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
              <th>Precio</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td>{producto.nombre}</td>
                <td>{producto.precio.toFixed(2)}</td>
                <td>{producto.stock}</td>
                <td>
                  <button type="button" onClick={() => editar(producto)}>Editar</button>
                  <button type="button" onClick={() => darDeBaja(producto.id)}>Dar de baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
