import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NuevaVenta from '../src/pages/NuevaVenta.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

const CLIENTES = [
  { id: 1, nombre: 'Cliente Demo', email: 'demo@cliente.local', telefono: '3510000000', activo: true }
];

const PRODUCTOS = [
  { id: 1, nombre: 'Teclado', precio: 15000, stock: 20, activo: true },
  { id: 2, nombre: 'Monitor', precio: 180000, stock: 5, activo: true }
];

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function renderizarNuevaVenta() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <NuevaVenta />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Pantalla de nueva venta', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/clientes') return respuestaOk(CLIENTES);
      if (url === '/api/productos') return respuestaOk(PRODUCTOS);
      return respuestaOk(null);
    }));
  });

  // ── TEST 3 del frontend — Restricción de UI ────────────────────
  it('deshabilita "Confirmar venta" mientras el carrito esté vacío', async () => {
    renderizarNuevaVenta();

    const boton = await screen.findByRole('button', { name: /confirmar venta/i });
    expect(boton).toBeDisabled();
    expect(screen.getByTestId('total-carrito')).toHaveTextContent('$ 0,00');
  });

  // ── TEST 2 del frontend — Cálculo ──────────────────────────────
  it('recalcula el total al agregar y al quitar líneas del carrito', async () => {
    const usuario = userEvent.setup();
    renderizarNuevaVenta();

    // Esperar a que carguen los selectores.
    await screen.findByRole('option', { name: 'Teclado' });

    // Línea 1: 2 teclados a 15000 = 30000
    await usuario.selectOptions(screen.getByLabelText(/producto/i), '1');
    await usuario.clear(screen.getByLabelText(/cantidad/i));
    await usuario.type(screen.getByLabelText(/cantidad/i), '2');
    await usuario.click(screen.getByRole('button', { name: /agregar/i }));

    expect(screen.getByTestId('total-carrito')).toHaveTextContent('$ 30.000,00');

    // Línea 2: 1 monitor a 180000 → total 210000
    await usuario.selectOptions(screen.getByLabelText(/producto/i), '2');
    await usuario.clear(screen.getByLabelText(/cantidad/i));
    await usuario.type(screen.getByLabelText(/cantidad/i), '1');
    await usuario.click(screen.getByRole('button', { name: /agregar/i }));

    expect(screen.getByTestId('total-carrito')).toHaveTextContent('$ 210.000,00');

    // Con el carrito lleno, el botón se habilita.
    expect(screen.getByRole('button', { name: /confirmar venta/i })).toBeEnabled();

    // Quitar el monitor → vuelve a 30000
    await usuario.click(screen.getByRole('button', { name: /quitar monitor/i }));

    // Esto es lo que el test 2 del TP5 realmente mide (regla de Cálculo):
    // que el total se RECALCULA al quitar una línea. La aserción original del
    // brief (`queryByText('Monitor')` ausente del documento) no puede pasar
    // nunca: el <select id="producto"> de esta misma pantalla sigue
    // renderizando <option>Monitor</option> aunque la línea se haya ido del
    // carrito. Por eso la línea "Monitor" se busca acotada a la tabla del
    // carrito (con `within`), no en todo el documento.
    expect(screen.getByTestId('total-carrito')).toHaveTextContent('$ 30.000,00');
    expect(within(screen.getByRole('table')).queryByText('Monitor')).not.toBeInTheDocument();
  });

  it('manda al backend solo producto_id y cantidad, sin precios', async () => {
    const usuario = userEvent.setup();
    renderizarNuevaVenta();

    await screen.findByRole('option', { name: 'Teclado' });

    await usuario.selectOptions(screen.getByLabelText(/cliente/i), '1');
    await usuario.selectOptions(screen.getByLabelText(/producto/i), '1');
    await usuario.clear(screen.getByLabelText(/cantidad/i));
    await usuario.type(screen.getByLabelText(/cantidad/i), '2');
    await usuario.click(screen.getByRole('button', { name: /agregar/i }));
    await usuario.click(screen.getByRole('button', { name: /confirmar venta/i }));

    const llamadaPost = fetch.mock.calls.find((llamada) => llamada[1].method === 'POST');
    expect(llamadaPost[0]).toBe('/api/ventas');
    expect(JSON.parse(llamadaPost[1].body)).toEqual({
      cliente_id: 1,
      items: [{ producto_id: 1, cantidad: 2 }]
    });
  });
});
