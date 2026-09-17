import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos el pool de conexión (config/db.js) para no necesitar MySQL real.
vi.mock('../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
    execute: vi.fn(),
    getConnection: vi.fn()
  }
}));

const { pool } = await import('../src/config/db.js');
const ventaModel = await import('../src/models/ventaModel.js');

describe('ventaModel.obtenerConexion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delega en pool.getConnection() (única puerta al pool para transacciones)', async () => {
    // Arrange
    const connFalsa = { execute: vi.fn() };
    pool.getConnection.mockResolvedValue(connFalsa);

    // Act
    const resultado = await ventaModel.obtenerConexion();

    // Assert
    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(resultado).toBe(connFalsa);
  });
});

describe('ventaModel.listar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mapea las filas a cabeceras y convierte total a número', async () => {
    // Arrange
    pool.query.mockResolvedValue([
      [{ id: 1, cliente_id: 2, cliente_nombre: 'Ana', fecha: '2026-01-01', total: '1500.75', estado: 'pendiente' }]
    ]);

    // Act
    const resultado = await ventaModel.listar();

    // Assert
    expect(resultado).toEqual([
      { id: 1, cliente_id: 2, cliente_nombre: 'Ana', fecha: '2026-01-01', total: 1500.75, estado: 'pendiente' }
    ]);
  });
});

describe('ventaModel.buscarCabecera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa la conexión de transacción cuando se pasa una (no cae al pool)', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([[{ id: 1, cliente_id: 2, cliente_nombre: 'Ana', fecha: 'x', total: '100', estado: 'pendiente' }]]) };

    // Act
    const resultado = await ventaModel.buscarCabecera(conn, 1);

    // Assert
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute).not.toHaveBeenCalled();
    expect(resultado.total).toBe(100);
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[{ id: 1, cliente_id: 2, cliente_nombre: 'Ana', fecha: 'x', total: '100', estado: 'pendiente' }]]);

    // Act
    const resultado = await ventaModel.buscarCabecera(null, 1);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(resultado.total).toBe(100);
  });

  it('devuelve null si no existe la venta', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await ventaModel.buscarCabecera(null, 999);

    // Assert
    expect(resultado).toBeNull();
  });
});

describe('ventaModel.buscarCabeceraParaActualizar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa FOR UPDATE y la conexión de transacción cuando se pasa una', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([[{ id: 1, cliente_id: 2, fecha: 'x', total: '250', estado: 'pendiente' }]]) };

    // Act
    const resultado = await ventaModel.buscarCabeceraParaActualizar(conn, 1);

    // Assert
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute).not.toHaveBeenCalled();
    const [sql] = conn.execute.mock.calls[0];
    expect(sql).toMatch(/FOR UPDATE/);
    expect(resultado).toEqual({ id: 1, cliente_id: 2, fecha: 'x', total: 250, estado: 'pendiente' });
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[{ id: 1, cliente_id: 2, fecha: 'x', total: '250', estado: 'pendiente' }]]);

    // Act
    const resultado = await ventaModel.buscarCabeceraParaActualizar(null, 1);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(resultado.total).toBe(250);
  });

  it('devuelve null si la venta no existe', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await ventaModel.buscarCabeceraParaActualizar(null, 999);

    // Assert
    expect(resultado).toBeNull();
  });
});

describe('ventaModel.listarItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa la conexión de transacción cuando se pasa una y mapea los ítems', async () => {
    // Arrange
    const conn = {
      execute: vi.fn().mockResolvedValue([
        [{ id: 1, producto_id: 5, producto_nombre: 'Mouse', cantidad: 2, precio_unitario: '100.00', subtotal: '200.00' }]
      ])
    };

    // Act
    const resultado = await ventaModel.listarItems(conn, 1);

    // Assert
    expect(pool.execute).not.toHaveBeenCalled();
    expect(resultado).toEqual([
      { id: 1, producto_id: 5, producto_nombre: 'Mouse', cantidad: 2, precio_unitario: 100, subtotal: 200 }
    ]);
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    await ventaModel.listarItems(null, 1);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });
});

describe('ventaModel.crearCabecera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta la cabecera en estado pendiente y devuelve el insertId', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([{ insertId: 42 }]) };

    // Act
    const resultado = await ventaModel.crearCabecera(conn, 7, 1000);

    // Assert
    expect(resultado).toBe(42);
    const [sql, params] = conn.execute.mock.calls[0];
    expect(sql).toMatch(/pendiente/);
    expect(params).toEqual([7, 1000]);
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ insertId: 1 }]);

    // Act
    await ventaModel.crearCabecera(null, 7, 1000);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });
});

describe('ventaModel.crearItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta el ítem con los datos del producto y devuelve el insertId', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([{ insertId: 11 }]) };
    const item = { producto_id: 5, cantidad: 2, precio_unitario: 100, subtotal: 200 };

    // Act
    const resultado = await ventaModel.crearItem(conn, 1, item);

    // Assert
    expect(resultado).toBe(11);
    const [, params] = conn.execute.mock.calls[0];
    expect(params).toEqual([1, 5, 2, 100, 200]);
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ insertId: 1 }]);
    const item = { producto_id: 5, cantidad: 2, precio_unitario: 100, subtotal: 200 };

    // Act
    await ventaModel.crearItem(null, 1, item);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });
});

describe('ventaModel.marcarAnulada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza el estado solo si estaba pendiente y devuelve las filas afectadas', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    // Act
    const resultado = await ventaModel.marcarAnulada(conn, 1);

    // Assert
    expect(resultado).toBe(1);
    const [sql] = conn.execute.mock.calls[0];
    expect(sql).toMatch(/estado = 'anulada'/);
    expect(sql).toMatch(/estado = 'pendiente'/);
  });

  it('devuelve 0 filas afectadas si ya estaba anulada', async () => {
    // Arrange
    const conn = { execute: vi.fn().mockResolvedValue([{ affectedRows: 0 }]) };

    // Act
    const resultado = await ventaModel.marcarAnulada(conn, 1);

    // Assert
    expect(resultado).toBe(0);
  });

  it('cae al pool cuando no se pasa conexión (conn ?? pool)', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

    // Act
    await ventaModel.marcarAnulada(null, 1);

    // Assert
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });
});
