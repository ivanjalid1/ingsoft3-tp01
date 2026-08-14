// Error de API con la misma forma que el contrato del backend.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const CLAVE_TOKEN = 'erp_token';
export const CLAVE_USUARIO = 'erp_usuario';

function armarCabeceras() {
  const cabeceras = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(CLAVE_TOKEN);
  if (token) {
    cabeceras.Authorization = `Bearer ${token}`;
  }
  return cabeceras;
}

// ÚNICO lugar de todo el frontend que llama a fetch. La ruta va sin el /api:
// apiFetch('/productos') pega a '/api/productos'. Siempre relativa: quien
// resuelve a dónde va /api es el proxy (Vite en dev, nginx en prod).
export async function apiFetch(ruta, opciones = {}) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: opciones.method ?? 'GET',
    headers: armarCabeceras(),
    body: opciones.body ? JSON.stringify(opciones.body) : undefined
  });

  // El backend siempre responde JSON, pero el que contesta puede no ser el
  // backend: si nginx no lo alcanza devuelve su propia página 502 en HTML, y
  // `JSON.parse('<html>...')` tiraba un SyntaxError crudo en pantalla. Ante un
  // cuerpo ilegible se degrada a `null` y el error sigue el mismo camino que
  // cualquier otro: un ApiError con el status real. El contrato no cambia.
  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    // Token vencido o inválido: se limpia la sesión y se vuelve al login.
    // Sin esto, el usuario quedaría con un token muerto y vería errores
    // sueltos en cada pantalla sin entender por qué.
    if (respuesta.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
      window.location.assign('/login');
    }

    const error = datos?.error ?? {};
    throw new ApiError(
      respuesta.status,
      error.code ?? 'ERROR_DESCONOCIDO',
      error.message ?? 'Error inesperado'
    );
  }

  return datos;
}

export const get = (ruta) => apiFetch(ruta);
export const post = (ruta, body) => apiFetch(ruta, { method: 'POST', body });
export const put = (ruta, body) => apiFetch(ruta, { method: 'PUT', body });
export const del = (ruta) => apiFetch(ruta, { method: 'DELETE' });
