import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Productos from '../src/pages/Productos.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function renderizarProductos() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Productos />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Pantalla de productos', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
    vi.stubGlobal('fetch', vi.fn(async () => respuestaOk([
      { id: 1, nombre: 'Teclado', precio: 15000, stock: 20, activo: true }
    ])));
  });

  // ── TEST 1 del frontend — Validación ───────────────────────────
  it('no envía el formulario con precio negativo: muestra el error y no llama a la API', async () => {
    const usuario = userEvent.setup();
    renderizarProductos();

    // Esperar a que termine el GET inicial del listado.
    expect(await screen.findByText('Teclado')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);

    await usuario.type(screen.getByLabelText(/nombre/i), 'Mouse');
    await usuario.type(screen.getByLabelText(/precio/i), '-5');
    await usuario.type(screen.getByLabelText(/stock/i), '30');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/precio debe ser mayor a cero/i);
    // Lo importante: no hubo un segundo fetch. El POST nunca salió.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('no envía el formulario con el nombre vacío: muestra el error y no llama a la API', async () => {
    const usuario = userEvent.setup();
    renderizarProductos();

    expect(await screen.findByText('Teclado')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);

    await usuario.type(screen.getByLabelText(/precio/i), '9500');
    await usuario.type(screen.getByLabelText(/stock/i), '30');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre es obligatorio/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('con datos válidos sí llama a la API', async () => {
    const usuario = userEvent.setup();
    renderizarProductos();

    expect(await screen.findByText('Teclado')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/nombre/i), 'Mouse');
    await usuario.type(screen.getByLabelText(/precio/i), '9500.5');
    await usuario.type(screen.getByLabelText(/stock/i), '30');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    // 1 = GET inicial, 2 = POST, 3 = GET de recarga del listado.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toBe('/api/productos');
    expect(fetch.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      nombre: 'Mouse', precio: 9500.5, stock: 30
    });
  });
});
