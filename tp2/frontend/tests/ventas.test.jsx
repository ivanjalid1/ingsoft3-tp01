import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Ventas from '../src/pages/Ventas.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

const VENTAS = [
  { id: 1, cliente_nombre: 'Cliente Demo', fecha: '2024-01-15T10:00:00Z', total: 30000, estado: 'confirmada' },
  { id: 2, cliente_nombre: 'Otro Cliente', fecha: '2024-01-16T10:00:00Z', total: 15000, estado: 'anulada' }
];

const DETALLE_VENTA_1 = {
  id: 1,
  items: [
    { id: 1, producto_nombre: 'Teclado', cantidad: 2, precio_unitario: 15000, subtotal: 30000 }
  ]
};

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function respuestaError(status, code, message) {
  return { ok: false, status, text: async () => JSON.stringify({ error: { code, message } }) };
}

function renderizarVentas() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Ventas />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Pantalla de ventas', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
  });

  it('muestra el estado vacío cuando no hay ventas registradas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaOk([])));

    renderizarVentas();

    expect(await screen.findByText('No hay ventas registradas')).toBeInTheDocument();
  });

  it('lista las ventas con cliente, total y estado, y deshabilita "Anular" en las ya anuladas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaOk(VENTAS)));

    renderizarVentas();

    expect(await screen.findByText('Cliente Demo')).toBeInTheDocument();
    expect(screen.getByText('Otro Cliente')).toBeInTheDocument();
    expect(screen.getByText('$ 30.000,00')).toBeInTheDocument();

    const filaAnulada = screen.getByText('Otro Cliente').closest('tr');
    expect(within(filaAnulada).getByRole('button', { name: /anular/i })).toBeDisabled();

    const filaConfirmada = screen.getByText('Cliente Demo').closest('tr');
    expect(within(filaConfirmada).getByRole('button', { name: /anular/i })).toBeEnabled();
  });

  it('muestra el error cuando falla la carga inicial del listado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError(500, 'ERROR_INTERNO', 'Error al cargar las ventas')));

    renderizarVentas();

    expect(await screen.findByRole('alert')).toHaveTextContent(/error al cargar las ventas/i);
  });

  it('expande y colapsa el detalle de una venta', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/ventas/1') return respuestaOk(DETALLE_VENTA_1);
      return respuestaOk(VENTAS);
    }));

    renderizarVentas();

    await screen.findByText('Cliente Demo');
    const filaVenta1 = screen.getByText('Cliente Demo').closest('tr');

    await usuario.click(within(filaVenta1).getByRole('button', { name: /ver detalle/i }));

    expect(await screen.findByText('Detalle de la venta 1')).toBeInTheDocument();
    expect(screen.getByText('Teclado')).toBeInTheDocument();
    expect(within(filaVenta1).getByRole('button', { name: /ocultar/i })).toBeInTheDocument();

    await usuario.click(within(filaVenta1).getByRole('button', { name: /ocultar/i }));

    expect(screen.queryByText('Detalle de la venta 1')).not.toBeInTheDocument();
    expect(within(filaVenta1).getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
  });

  it('anula una venta con éxito: oculta el detalle y refresca el listado', async () => {
    const usuario = userEvent.setup();
    let ventasActuales = VENTAS;
    const fetchMock = vi.fn(async (url, opciones = {}) => {
      if (url === '/api/ventas/1' && (!opciones.method || opciones.method === 'GET')) {
        return respuestaOk(DETALLE_VENTA_1);
      }
      if (url === '/api/ventas/1/anular' && opciones.method === 'POST') {
        ventasActuales = ventasActuales.map((v) => (v.id === 1 ? { ...v, estado: 'anulada' } : v));
        return respuestaOk({ ok: true });
      }
      if (url === '/api/ventas') return respuestaOk(ventasActuales);
      return respuestaOk(null);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderizarVentas();

    await screen.findByText('Cliente Demo');
    const filaVenta1 = screen.getByText('Cliente Demo').closest('tr');

    // Primero se expande el detalle, para verificar que anular lo oculta.
    await usuario.click(within(filaVenta1).getByRole('button', { name: /ver detalle/i }));
    expect(await screen.findByText('Detalle de la venta 1')).toBeInTheDocument();

    await usuario.click(within(filaVenta1).getByRole('button', { name: /anular/i }));

    // El detalle se cierra y el listado se recarga: la fila pasa a "anulada".
    expect(await within(filaVenta1).findByText('anulada')).toBeInTheDocument();
    expect(screen.queryByText('Detalle de la venta 1')).not.toBeInTheDocument();

    const llamadaAnular = fetchMock.mock.calls.find(([url]) => url === '/api/ventas/1/anular');
    expect(llamadaAnular[1].method).toBe('POST');
  });

  it('si el backend rechaza la anulación (409), muestra el mensaje de error y no recarga el listado', async () => {
    const usuario = userEvent.setup();
    const fetchMock = vi.fn(async (url, opciones = {}) => {
      if (url === '/api/ventas/1/anular' && opciones.method === 'POST') {
        return respuestaError(409, 'VENTA_YA_ANULADA', 'La venta 1 ya está anulada');
      }
      return respuestaOk(VENTAS);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderizarVentas();

    await screen.findByText('Cliente Demo');
    const filaVenta1 = screen.getByText('Cliente Demo').closest('tr');

    await usuario.click(within(filaVenta1).getByRole('button', { name: /anular/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/la venta 1 ya está anulada/i);
    // 1 = GET inicial, 2 = POST que falló. Sin recarga posterior del listado.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
