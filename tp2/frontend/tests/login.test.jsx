import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../src/pages/Login.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function respuestaError(status, code, message) {
  return { ok: false, status, text: async () => JSON.stringify({ error: { code, message } }) };
}

function renderizarLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/productos" element={<h1>Productos</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function completarFormulario(usuario, email, password) {
  await usuario.type(screen.getByLabelText(/email/i), email);
  await usuario.type(screen.getByLabelText(/contraseña/i), password);
  await usuario.click(screen.getByRole('button', { name: /ingresar/i }));
}

describe('Pantalla de login', () => {
  it('con credenciales inválidas (401) muestra el error de la API y no navega', async () => {
    const usuario = userEvent.setup();
    // Nota: apiFetch, ante un 401 fuera de /login, llama a
    // window.location.assign('/login') para tirar la sesión muerta. jsdom no
    // implementa navegación real y loguea "Not implemented: navigation" en
    // stderr; no es un fallo del test (la property de location no se puede
    // redefinir en esta versión de jsdom, así que no se stubea).
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuestaError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos')
    ));

    renderizarLogin();
    await completarFormulario(usuario, 'mal@mail.com', 'incorrecta');

    expect(await screen.findByRole('alert')).toHaveTextContent(/email o contraseña incorrectos/i);
    expect(screen.queryByRole('heading', { name: /productos/i })).not.toBeInTheDocument();
  });

  it('ante un error de red muestra el mensaje del error y no navega', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    renderizarLogin();
    await completarFormulario(usuario, 'demo@mail.com', 'demo123');

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to fetch/i);
    expect(screen.queryByRole('heading', { name: /productos/i })).not.toBeInTheDocument();
  });

  it('ante un error 500 del servidor muestra el mensaje devuelto por la API', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () =>
      respuestaError(500, 'ERROR_INTERNO', 'Error inesperado del servidor')
    ));

    renderizarLogin();
    await completarFormulario(usuario, 'demo@mail.com', 'demo123');

    expect(await screen.findByRole('alert')).toHaveTextContent(/error inesperado del servidor/i);
  });

  it('con credenciales válidas guarda la sesión y navega a /productos', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => respuestaOk({
      token: 'token-valido',
      usuario: { email: 'demo@mail.com' }
    })));

    renderizarLogin();
    await completarFormulario(usuario, 'demo@mail.com', 'demo123');

    expect(await screen.findByRole('heading', { name: /productos/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
