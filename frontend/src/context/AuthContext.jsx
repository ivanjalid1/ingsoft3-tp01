import { createContext, useContext, useState } from 'react';
import { post, CLAVE_TOKEN, CLAVE_USUARIO } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // El estado se inicializa DESDE localStorage: así un F5 no desloguea.
  // Si CLAVE_USUARIO quedó con un valor ilegible (escritura a medias, cambio
  // de formato entre versiones, alguien tocando el storage a mano), tratamos
  // la sesión como inexistente en vez de dejar que JSON.parse tumbe el primer
  // render: para el usuario es indistinguible de "se venció la sesión".
  const [token, setToken] = useState(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_USUARIO);
      if (guardado) JSON.parse(guardado);
      return localStorage.getItem(CLAVE_TOKEN);
    } catch {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
      return null;
    }
  });
  const [usuario, setUsuario] = useState(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_USUARIO);
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
      return null;
    }
  });

  async function login(email, password) {
    const datos = await post('/auth/login', { email, password });
    localStorage.setItem(CLAVE_TOKEN, datos.token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos.usuario));
    setToken(datos.token);
    setUsuario(datos.usuario);
    return datos.usuario;
  }

  function logout() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    setToken(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ token, usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
