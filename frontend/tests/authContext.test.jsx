import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
