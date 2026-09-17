import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN, CLAVE_USUARIO } from '../src/api/client.js';

function ConsumidorAuth() {
  const { token, usuario } = useAuth();
  return (
    <p data-testid="estado">
      {token ?? 'sin-token'}|{usuario ? usuario.email : 'sin-usuario'}
    </p>
  );
}

// Consumidor con botones para ejercitar login/logout desde un test, sin
// depender de la pantalla de Login (esa ya tiene su propia suite).
function ConsumidorAuthConAcciones() {
  const { token, usuario, login, logout } = useAuth();
  const [error, setError] = useState('');

  async function manejarLogin() {
    setError('');
    try {
      await login('demo@mail.com', 'demo123');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <p data-testid="estado">
        {token ?? 'sin-token'}|{usuario ? usuario.email : 'sin-usuario'}
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={manejarLogin}>Login</button>
      <button type="button" onClick={logout}>Logout</button>
    </div>
  );
}

function renderizarConsumidorConAcciones() {
  return render(
    <AuthProvider>
      <ConsumidorAuthConAcciones />
    </AuthProvider>
  );
}

function renderizarConsumidor() {
  return render(
    <AuthProvider>
      <ConsumidorAuth />
    </AuthProvider>
  );
}

describe('AuthContext — sesión corrupta en localStorage', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE_TOKEN, 'token-valido');
    localStorage.setItem(CLAVE_USUARIO, '{corrupto');
  });

  it('no lanza al inicializar y deja al usuario deslogueado', () => {
    expect(() => renderizarConsumidor()).not.toThrow();

    expect(screen.getByTestId('estado')).toHaveTextContent('sin-token|sin-usuario');
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(localStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });
});

describe('AuthContext — login y logout', () => {
  it('login guarda token y usuario en localStorage y actualiza el contexto', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'token-nuevo', usuario: { email: 'demo@mail.com' } })
    })));

    renderizarConsumidorConAcciones();
    expect(screen.getByTestId('estado')).toHaveTextContent('sin-token|sin-usuario');

    await usuario.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByTestId('estado')).toHaveTextContent('token-nuevo|demo@mail.com');
    expect(localStorage.getItem(CLAVE_TOKEN)).toBe('token-nuevo');
    expect(JSON.parse(localStorage.getItem(CLAVE_USUARIO))).toEqual({ email: 'demo@mail.com' });
  });

  it('logout limpia la sesión de localStorage y del contexto', async () => {
    const usuario = userEvent.setup();
    localStorage.setItem(CLAVE_TOKEN, 'token-viejo');
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify({ email: 'viejo@mail.com' }));

    renderizarConsumidorConAcciones();
    expect(screen.getByTestId('estado')).toHaveTextContent('token-viejo|viejo@mail.com');

    await usuario.click(screen.getByRole('button', { name: /logout/i }));

    expect(screen.getByTestId('estado')).toHaveTextContent('sin-token|sin-usuario');
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(localStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });

  it('con credenciales inválidas no persiste nada y propaga el error a quien llama a login', async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({
        error: { code: 'CREDENCIALES_INVALIDAS', message: 'Email o contraseña incorrectos' }
      })
    })));

    renderizarConsumidorConAcciones();

    await usuario.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/email o contraseña incorrectos/i);
    expect(screen.getByTestId('estado')).toHaveTextContent('sin-token|sin-usuario');
    expect(localStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(localStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });
});
