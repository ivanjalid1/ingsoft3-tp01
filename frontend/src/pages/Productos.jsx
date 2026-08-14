import { useEffect, useState } from 'react';
import { get } from '../api/client.js';
import Nav from '../components/Nav.jsx';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/productos')
      .then(setProductos)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Productos</h1>
        {error && <p role="alert" className="error">{error}</p>}
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td>{producto.nombre}</td>
                <td>{producto.precio.toFixed(2)}</td>
                <td>{producto.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
