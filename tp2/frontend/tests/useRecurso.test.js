import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRecurso } from '../src/hooks/useRecurso.js';

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function respuestaError(status, code, message) {
  return { ok: false, status, text: async () => JSON.stringify({ error: { code, message } }) };
}

describe('useRecurso', () => {
  it('carga el listado inicial al montar (estado de éxito)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaOk([{ id: 1, nombre: 'Teclado' }])));

    const { result } = renderHook(() => useRecurso('/productos'));

    // Arranca vacío (todavía no resolvió el fetch inicial).
    expect(result.current.items).toEqual([]);

    await waitFor(() => expect(result.current.items).toEqual([{ id: 1, nombre: 'Teclado' }]));
    expect(fetch).toHaveBeenCalledWith('/api/productos', expect.objectContaining({ method: 'GET' }));
    expect(result.current.error).toBe('');
  });

  it('setea el mensaje de error cuando falla la carga inicial', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaError(500, 'ERROR_INTERNO', 'Error del servidor')));

    const { result } = renderHook(() => useRecurso('/productos'));

    await waitFor(() => expect(result.current.error).toBe('Error del servidor'));
    expect(result.current.items).toEqual([]);
  });

  it('crear: en éxito limpia el error, recarga el listado y devuelve true', async () => {
    let creado = false;
    vi.stubGlobal('fetch', vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'POST') {
        creado = true;
        return respuestaOk({ id: 2, nombre: 'Nuevo' });
      }
      return respuestaOk(creado ? [{ id: 2, nombre: 'Nuevo' }] : []);
    }));

    const { result } = renderHook(() => useRecurso('/productos'));
    await waitFor(() => expect(result.current.items).toEqual([]));

    let ok;
    await act(async () => {
      ok = await result.current.crear({ nombre: 'Nuevo' });
    });

    expect(ok).toBe(true);
    expect(result.current.items).toEqual([{ id: 2, nombre: 'Nuevo' }]);
  });

  it('crear: en error setea el mensaje y devuelve false sin recargar', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'POST') return respuestaError(400, 'DATOS_INVALIDOS', 'Datos inválidos');
      return respuestaOk([]);
    }));

    const { result } = renderHook(() => useRecurso('/productos'));
    await waitFor(() => expect(result.current.items).toEqual([]));

    let ok;
    await act(async () => {
      ok = await result.current.crear({ nombre: '' });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Datos inválidos');
  });

  it('actualizar: en éxito recarga el listado y devuelve true', async () => {
    let actualizado = false;
    vi.stubGlobal('fetch', vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'PUT') {
        actualizado = true;
        return respuestaOk({ id: 1, nombre: 'Editado' });
      }
      return respuestaOk(actualizado ? [{ id: 1, nombre: 'Editado' }] : [{ id: 1, nombre: 'Original' }]);
    }));

    const { result } = renderHook(() => useRecurso('/productos'));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1, nombre: 'Original' }]));

    let ok;
    await act(async () => {
      ok = await result.current.actualizar(1, { nombre: 'Editado' });
    });

    expect(ok).toBe(true);
    expect(result.current.items).toEqual([{ id: 1, nombre: 'Editado' }]);
  });

  it('darDeBaja: recarga el listado en éxito', async () => {
    let dadoDeBaja = false;
    vi.stubGlobal('fetch', vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'DELETE') {
        dadoDeBaja = true;
        return respuestaOk(null);
      }
      return respuestaOk(dadoDeBaja ? [] : [{ id: 1, nombre: 'Teclado' }]);
    }));

    const { result } = renderHook(() => useRecurso('/productos'));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1, nombre: 'Teclado' }]));

    await act(async () => {
      await result.current.darDeBaja(1);
    });

    expect(result.current.items).toEqual([]);
  });

  it('darDeBaja: en error setea el mensaje de error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'DELETE') return respuestaError(409, 'EN_USO', 'El recurso está en uso');
      return respuestaOk([{ id: 1, nombre: 'Teclado' }]);
    }));

    const { result } = renderHook(() => useRecurso('/productos'));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1, nombre: 'Teclado' }]));

    await act(async () => {
      await result.current.darDeBaja(1);
    });

    expect(result.current.error).toBe('El recurso está en uso');
  });
});
