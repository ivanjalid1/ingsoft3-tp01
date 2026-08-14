import { useEffect, useState } from 'react';
import { get, post } from '../api/client.js';
import { formatearMonto } from '../utils/formato.js';

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [detalle, setDetalle] = useState(null);   // venta expandida, con items
  const [error, setError] = useState('');

  async function cargar() {
    try {
      // GET /api/ventas devuelve TODAS las ventas, anuladas incluidas: el
      // backend no filtra ni pagina. La distinción entre pendiente/anulada
      // se hace acá, del lado del cliente, con el campo `estado` que ya
      // viene en cada elemento — sin agregar ningún query param al backend.
      setVentas(await get('/ventas'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function alternarDetalle(id) {
    if (detalle && detalle.id === id) {
      setDetalle(null);
      return;
    }
    try {
      setDetalle(await get(`/ventas/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function anular(id) {
    setError('');
    try {
      await post(`/ventas/${id}/anular`);
      setDetalle(null);
      await cargar();
    } catch (err) {
      // Acá cae el 409 VENTA_YA_ANULADA con su mensaje.
      setError(err.message);
    }
  }

  return (
    <>
      <h1>Ventas</h1>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="card">
        {ventas.length === 0 ? (
          <div className="estado-vacio">
            <strong>No hay ventas registradas</strong>
            <span>Las ventas que confirmes en "Nueva venta" van a aparecer acá.</span>
          </div>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th className="num-header">#</th>
                  <th>Cliente</th>
                  <th className="num-header">Fecha</th>
                  <th className="num-header">Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((venta) => (
                  <tr key={venta.id} className={venta.estado === 'anulada' ? 'venta--anulada' : undefined}>
                    <td className="num">{venta.id}</td>
                    <td>{venta.cliente_nombre}</td>
                    <td className="num">{new Date(venta.fecha).toLocaleString('es-AR')}</td>
                    <td className="num">{formatearMonto(venta.total)}</td>
                    <td>
                      <span className={`pill pill--${venta.estado}`}>{venta.estado}</span>
                    </td>
                    <td>
                      <div className="acciones-form">
                        <button type="button" onClick={() => alternarDetalle(venta.id)}>
                          {detalle && detalle.id === venta.id ? 'Ocultar' : 'Ver detalle'}
                        </button>
                        <button
                          type="button"
                          className="btn--danger"
                          onClick={() => anular(venta.id)}
                          disabled={venta.estado === 'anulada'}
                        >
                          Anular
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalle && (
        <div className="card">
          <h2 className="card__header">{`Detalle de la venta ${detalle.id}`}</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num-header">Cantidad</th>
                  <th className="num-header">Precio unitario</th>
                  <th className="num-header">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalle.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.producto_nombre}</td>
                    <td className="num">{item.cantidad}</td>
                    <td className="num">{formatearMonto(item.precio_unitario)}</td>
                    <td className="num">{formatearMonto(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
