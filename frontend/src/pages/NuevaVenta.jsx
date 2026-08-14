import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../api/client.js';
import Nav from '../components/Nav.jsx';

// Misma regla que ventaService.redondear() en el backend: redondear a dos
// decimales después de cada operación evita que un binario tipo 0.1 + 0.2 se
// cuele en el total. Si esta función no coincidiera con la del backend,
// aparecería un centavo de diferencia entre lo que muestra la pantalla y lo
// que termina persistido.
function redondear(monto) {
  return Math.round(monto * 100) / 100;
}

export default function NuevaVenta() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      try {
        const [listaClientes, listaProductos] = await Promise.all([
          get('/clientes'),
          get('/productos')
        ]);
        setClientes(listaClientes);
        setProductos(listaProductos);
      } catch (err) {
        setError(err.message);
      }
    }
    cargar();
  }, []);

  // El total se DERIVA del carrito en cada render, igual que el backend lo
  // deriva de las líneas dentro de la transacción: no hay un useState para
  // el total, porque si lo hubiera habría dos fuentes de verdad que podrían
  // desincronizarse. Se acumula con la misma función `redondear` que usa
  // ventaService, en el mismo orden (una línea por vez), para que el
  // resultado coincida centavo a centavo con lo que el backend calcula y
  // persiste.
  const total = carrito.reduce((suma, linea) => redondear(suma + linea.subtotal), 0);

  function agregar() {
    const producto = productos.find((p) => p.id === Number(productoId));
    const cantidadNumero = Number(cantidad);

    if (!producto) {
      setError('Elegí un producto');
      return;
    }
    if (!Number.isInteger(cantidadNumero) || cantidadNumero <= 0) {
      setError('La cantidad debe ser un entero mayor a cero');
      return;
    }

    setError('');
    setCarrito((anterior) => {
      // El backend consolida por producto_id: dos líneas del mismo producto
      // en el mismo POST se suman y se validan una sola vez contra el stock.
      // El carrito consolida también al agregar, así el total que se ve en
      // pantalla es exactamente el que el backend va a calcular y persistir
      // (una sola línea por producto, nunca dos parciales que sumen distinto
      // por culpa del redondeo).
      const existente = anterior.find((linea) => linea.producto_id === producto.id);
      if (existente) {
        const cantidadNueva = existente.cantidad + cantidadNumero;
        return anterior.map((linea) => (
          linea.producto_id === producto.id
            ? {
                ...linea,
                cantidad: cantidadNueva,
                subtotal: redondear(cantidadNueva * linea.precio_unitario)
              }
            : linea
        ));
      }
      return [
        ...anterior,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: cantidadNumero,
          precio_unitario: producto.precio,
          subtotal: redondear(cantidadNumero * producto.precio)
        }
      ];
    });
    setCantidad('1');
  }

  function quitar(indice) {
    setCarrito((anterior) => anterior.filter((_, i) => i !== indice));
  }

  async function confirmar() {
    if (!clienteId) {
      setError('Elegí un cliente');
      return;
    }
    setError('');
    try {
      // Solo producto_id y cantidad: el precio y el total los calcula el
      // backend. Mandarlos desde acá sería confiar en el navegador para
      // determinar cuánto se cobra.
      await post('/ventas', {
        cliente_id: Number(clienteId),
        items: carrito.map((linea) => ({
          producto_id: linea.producto_id,
          cantidad: linea.cantidad
        }))
      });
      setCarrito([]);
      navigate('/ventas');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Nueva venta</h1>

        <label htmlFor="cliente">Cliente</label>
        <select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Elegí un cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
          ))}
        </select>

        <label htmlFor="producto">Producto</label>
        <select id="producto" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
          <option value="">Elegí un producto</option>
          {productos.map((producto) => (
            <option key={producto.id} value={producto.id}>{producto.nombre}</option>
          ))}
        </select>

        <label htmlFor="cantidad">Cantidad</label>
        <input id="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />

        <button type="button" onClick={agregar}>Agregar</button>

        {error && <p role="alert" className="error">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carrito.map((linea, indice) => (
              <tr key={linea.producto_id}>
                <td>{linea.nombre}</td>
                <td>{linea.cantidad}</td>
                <td>{linea.precio_unitario.toFixed(2)}</td>
                <td>{linea.subtotal.toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => quitar(indice)}>
                    {`Quitar ${linea.nombre}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="total">
          Total: <span data-testid="total-carrito">{total.toFixed(2)}</span>
        </p>

        <button type="button" onClick={confirmar} disabled={carrito.length === 0}>
          Confirmar venta
        </button>
      </main>
    </>
  );
}
