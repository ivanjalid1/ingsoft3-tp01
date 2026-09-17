import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos el pool de conexión (config/db.js) para no necesitar MySQL real.
vi.mock('../src/config/db.js', () => ({
  pool: {
    execute: vi.fn()
  }
}));

const { pool } = await import('../src/config/db.js');
const usuarioModel = await import('../src/models/usuarioModel.js');

describe('usuarioModel.buscarPorEmailConHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la fila con el password_hash si el usuario existe', async () => {
    // Arrange
    pool.execute.mockResolvedValue([
      [{ id: 1, email: 'admin@erp.local', password_hash: 'hash-falso' }]
    ]);

    // Act
    const resultado = await usuarioModel.buscarPorEmailConHash('admin@erp.local');

    // Assert
    expect(resultado).toEqual({ id: 1, email: 'admin@erp.local', password_hash: 'hash-falso' });
    expect(pool.execute).toHaveBeenCalledWith(expect.stringMatching(/password_hash/), ['admin@erp.local']);
  });

  it('devuelve null si no existe ningún usuario con ese email', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await usuarioModel.buscarPorEmailConHash('nadie@erp.local');

    // Assert
    expect(resultado).toBeNull();
  });
});
