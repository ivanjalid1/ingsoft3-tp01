import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, ApiError } from '../src/api/client.js';

describe('apiFetch — respuesta que no es JSON', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Si el backend está caído, quien contesta es nginx, y nginx contesta su
  // propia página de error en HTML. `JSON.parse('<html>...')` tiraba un
  // SyntaxError crudo: el usuario veía "Unexpected token '<'" en pantalla en
  // vez de un mensaje de error. La guarda degrada el cuerpo ilegible a null y
  // el error sale por el mismo camino que todos: un ApiError con el status real.
  it('convierte un 502 en HTML de nginx en un ApiError legible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('<html><head><title>502 Bad Gateway</title></head></html>')
    }));

    const error = await apiFetch('/productos').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Error inesperado');
  });

  // El camino normal no cambia: un error del backend sigue trayendo su code y
  // su message del contrato `{ error: { code, message } }`.
  it('sigue leyendo el code y el message cuando el cuerpo SÍ es JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve(JSON.stringify({
        error: { code: 'VENTA_YA_ANULADA', message: 'La venta 7 ya está anulada' }
      }))
    }));

    const error = await apiFetch('/ventas/7/anular', { method: 'POST' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('VENTA_YA_ANULADA');
    expect(error.message).toBe('La venta 7 ya está anulada');
  });
});
