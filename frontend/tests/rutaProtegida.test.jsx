import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

function renderizarEn(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('RutaProtegida', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  // ── TEST 4 del frontend — Autorización ─────────────────────────
  it('redirige a /login cuando no hay token en localStorage', async () => {
    renderizarEn('/productos');

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // La pantalla protegida no llegó a montarse, así que nunca pidió datos.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deja pasar a /productos cuando hay token', async () => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    });

    renderizarEn('/productos');

    expect(await screen.findByRole('heading', { name: /productos/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });
});
