import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos el pool de conexión (config/db.js) para no necesitar MySQL real.
// pool.query/execute son las dos formas en que productoModel toca la base.
vi.mock('../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
    execute: vi.fn()
  }
}));

const { pool } = await import('../src/config/db.js');
const productoModel = await import('../src/models/productoModel.js');

describe('productoModel.listar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mapea las filas a productos y convierte precio/activo', async () => {
    // Arrange
    pool.query.mockResolvedValue([
      [{ id: 1, nombre: 'Mouse', precio: '9500.50', stock: 30, activo: 1 }]
    ]);

    // Act
    const resultado = await productoModel.listar();

    // Assert
    expect(resultado).toEqual([
      { id: 1, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true }
    ]);
  });

  it('consulta solo los activos cuando incluirInactivos es false (por defecto)', async () => {
    // Arrange
    pool.query.mockResolvedValue([[]]);

    // Act
    await productoModel.listar();

    // Assert
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE activo = 1/);
  });

  it('incluye los inactivos cuando incluirInactivos es true', async () => {
    // Arrange
    pool.query.mockResolvedValue([[]]);

    // Act
    await productoModel.listar(true);

    // Assert
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE activo = 1/);
  });
});

describe('productoModel.buscarPorId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve el producto mapeado si la fila existe', async () => {
    // Arrange
    pool.execute.mockResolvedValue([
      [{ id: 5, nombre: 'Teclado', precio: '15000', stock: 10, activo: 0 }]
    ]);

    // Act
    const resultado = await productoModel.buscarPorId(5);

    // Assert
    expect(resultado).toEqual({ id: 5, nombre: 'Teclado', precio: 15000, stock: 10, activo: false });
  });

  it('devuelve null si no hay ninguna fila', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await productoModel.buscarPorId(999);

    // Assert
    expect(resultado).toBeNull();
  });
});

describe('productoModel.buscarPorIdParaActualizar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa la conexión de transacción cuando se pasa una (no cae al pool)', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([[{ id: 1, nombre: 'Mouse', precio: '100', stock: 5 }]]) };

    // Act
    const resultado = await productoModel.buscarPorIdParaActualizar(conn, 1);

    // Assert
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute).not.toHaveBeenCalled();
    expect(resultado).toEqual({ id: 1, nombre: 'Mouse', precio: 100, stock: 5 });
    const [sql] = conn.execute.mock.calls[0];
    expect(sql).toMatch(/FOR UPDATE/);
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[{ id: 2, nombre: 'Monitor', precio: '200', stock: 3 }]]);

    // Act
    const resultado = await productoModel.buscarPorIdParaActualizar(null, 2);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ id: 2, nombre: 'Monitor', precio: 200, stock: 3 });
  });

  it('devuelve null si el producto no existe o está inactivo', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await productoModel.buscarPorIdParaActualizar(null, 999);

    // Assert
    expect(resultado).toBeNull();
  });
});

describe('productoModel.crear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta y devuelve el producto recién creado buscándolo por su insertId', async () => {
    // Arrange
    pool.execute
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([[{ id: 7, nombre: 'Mouse', precio: '500', stock: 1, activo: 1 }]]);

    // Act
    const resultado = await productoModel.crear({ nombre: 'Mouse', precio: 500, stock: 1 });

    // Assert
    expect(resultado).toEqual({ id: 7, nombre: 'Mouse', precio: 500, stock: 1, activo: true });
  });
});

describe('productoModel.actualizar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza la fila y devuelve el producto ya actualizado', async () => {
    // Arrange
    pool.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 3, nombre: 'Mouse Pro', precio: '600', stock: 8, activo: 1 }]]);

    // Act
    const resultado = await productoModel.actualizar(3, { nombre: 'Mouse Pro', precio: 600, stock: 8 });

    // Assert
    expect(resultado).toEqual({ id: 3, nombre: 'Mouse Pro', precio: 600, stock: 8, activo: true });
  });
});

describe('productoModel.desactivar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la cantidad de filas afectadas', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

    // Act
    const resultado = await productoModel.desactivar(3);

    // Assert
    expect(resultado).toBe(1);
  });
});

describe('productoModel.descontarStock / reponerStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('descontarStock usa la conexión de transacción cuando se pasa una', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    // Act
    const resultado = await productoModel.descontarStock(conn, 1, 2);

    // Assert
    expect(conn.execute).toHaveBeenCalledWith(expect.stringMatching(/stock = stock - \?/), [2, 1]);
    expect(pool.execute).not.toHaveBeenCalled();
    expect(resultado).toBe(1);
  });

  it('descontarStock cae al pool cuando no se pasa conexión', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

    // Act
    await productoModel.descontarStock(null, 1, 2);

    // Assert
    expect(pool.execute).toHaveBeenCalledWith(expect.stringMatching(/stock = stock - \?/), [2, 1]);
  });

  it('reponerStock usa la conexión de transacción cuando se pasa una', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    // Act
    const resultado = await productoModel.reponerStock(conn, 1, 4);

    // Assert
    expect(conn.execute).toHaveBeenCalledWith(expect.stringMatching(/stock = stock \+ \?/), [4, 1]);
    expect(pool.execute).not.toHaveBeenCalled();
    expect(resultado).toBe(1);
  });

  it('reponerStock cae al pool cuando no se pasa conexión', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

    // Act
    await productoModel.reponerStock(null, 1, 4);

    // Assert
    expect(pool.execute).toHaveBeenCalledWith(expect.stringMatching(/stock = stock \+ \?/), [4, 1]);
  });
});
