import { createContext, useContext, useState } from 'react';
import { post, CLAVE_TOKEN, CLAVE_USUARIO } from '../api/client.js';

const AuthContext = createContext(null);

const SIN_SESION = { token: null, usuario: null };

// Lee la sesión guardada de una sola vez y devuelve las dos piezas juntas.
// Si CLAVE_USUARIO quedó con un valor ilegible (escritura a medias, cambio de
// formato entre versiones, alguien tocando el storage a mano), la sesión entera
// se descarta —token incluido— en vez de dejar que JSON.parse tumbe el primer
// render: para el usuario es indistinguible de "se venció la sesión".
// Antes esto vivía repartido en dos inicializadores que parseaban el mismo
// valor dos veces, y el primero tiraba el resultado del parse: solo lo hacía
// para detectar la corrupción. Una lectura, un parse, un lugar que limpia.
function leerSesion() {
  try {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    return {
      token: localStorage.getItem(CLAVE_TOKEN),
      usuario: guardado ? JSON.parse(guardado) : null
    };
  } catch {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    return SIN_SESION;
  }
}

export function AuthProvider({ children }) {
  // El estado se inicializa DESDE localStorage: así un F5 no desloguea.
  // Token y usuario son UNA sola pieza de estado porque siempre cambian juntos
  // (login los pone los dos, logout los borra los dos). Como inicializador lazy,
  // `leerSesion` corre exactamente una vez, en el primer render.
  const [sesion, setSesion] = useState(leerSesion);
  const { token, usuario } = sesion;

  async function login(email, password) {
    const datos = await post('/auth/login', { email, password });
    localStorage.setItem(CLAVE_TOKEN, datos.token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos.usuario));
    setSesion({ token: datos.token, usuario: datos.usuario });
    return datos.usuario;
  }

  function logout() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    setSesion(SIN_SESION);
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
