import { createContext, useContext, useState } from 'react';
import { post, CLAVE_TOKEN, CLAVE_USUARIO } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // El estado se inicializa DESDE localStorage: así un F5 no desloguea.
  const [token, setToken] = useState(() => localStorage.getItem(CLAVE_TOKEN));
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    return guardado ? JSON.parse(guardado) : null;
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
