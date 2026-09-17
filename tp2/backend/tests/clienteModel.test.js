import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mockeamos el pool de conexión (config/db.js) para no necesitar MySQL real.
vi.mock('../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
    execute: vi.fn()
  }
}));

const { pool } = await import('../src/config/db.js');
const clienteModel = await import('../src/models/clienteModel.js');

describe('clienteModel.listar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mapea las filas a clientes y convierte activo a booleano', async () => {
    // Arrange
    pool.query.mockResolvedValue([
      [{ id: 1, nombre: 'Ana', email: 'ana@mail.com', telefono: '351', activo: 1 }]
    ]);

    // Act
    const resultado = await clienteModel.listar();

    // Assert
    expect(resultado).toEqual([
      { id: 1, nombre: 'Ana', email: 'ana@mail.com', telefono: '351', activo: true }
    ]);
  });

  it('consulta solo los activos cuando incluirInactivos es false (por defecto)', async () => {
    // Arrange
    pool.query.mockResolvedValue([[]]);

    // Act
    await clienteModel.listar();

    // Assert
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE activo = 1/);
  });

  it('incluye los inactivos cuando incluirInactivos es true', async () => {
    // Arrange
    pool.query.mockResolvedValue([[]]);

    // Act
    await clienteModel.listar(true);

    // Assert
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE activo = 1/);
  });
});

describe('clienteModel.buscarPorId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve el cliente mapeado si la fila existe', async () => {
    // Arrange
    pool.execute.mockResolvedValue([
      [{ id: 2, nombre: 'Beto', email: 'beto@mail.com', telefono: null, activo: 0 }]
    ]);

    // Act
    const resultado = await clienteModel.buscarPorId(2);

    // Assert
    expect(resultado).toEqual({ id: 2, nombre: 'Beto', email: 'beto@mail.com', telefono: null, activo: false });
  });

  it('devuelve null si no hay ninguna fila', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await clienteModel.buscarPorId(999);

    // Assert
    expect(resultado).toBeNull();
  });
});

describe('clienteModel.buscarPorEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve el cliente mapeado si existe alguien con ese email', async () => {
    // Arrange
    pool.execute.mockResolvedValue([
      [{ id: 3, nombre: 'Cami', email: 'cami@mail.com', telefono: '351', activo: 1 }]
    ]);

    // Act
    const resultado = await clienteModel.buscarPorEmail('cami@mail.com');

    // Assert
    expect(resultado).toEqual({ id: 3, nombre: 'Cami', email: 'cami@mail.com', telefono: '351', activo: true });
  });

  it('devuelve null si ningún cliente tiene ese email', async () => {
    // Arrange
    pool.execute.mockResolvedValue([[]]);

    // Act
    const resultado = await clienteModel.buscarPorEmail('nadie@mail.com');

    // Assert
    expect(resultado).toBeNull();
  });
});

describe('clienteModel.crear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserta y devuelve el cliente recién creado buscándolo por su insertId', async () => {
    // Arrange
    pool.execute
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([[{ id: 9, nombre: 'Dani', email: 'dani@mail.com', telefono: '351', activo: 1 }]]);

    // Act
    const resultado = await clienteModel.crear({ nombre: 'Dani', email: 'dani@mail.com', telefono: '351' });

    // Assert
    expect(resultado).toEqual({ id: 9, nombre: 'Dani', email: 'dani@mail.com', telefono: '351', activo: true });
  });

  it('inserta el teléfono como null cuando no viene en los datos', async () => {
    // Arrange
    pool.execute
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([[{ id: 10, nombre: 'Eli', email: 'eli@mail.com', telefono: null, activo: 1 }]]);

    // Act
    await clienteModel.crear({ nombre: 'Eli', email: 'eli@mail.com' });

    // Assert
    const [, params] = pool.execute.mock.calls[0];
    expect(params).toEqual(['Eli', 'eli@mail.com', null]);
  });
});

describe('clienteModel.actualizar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza la fila y devuelve el cliente ya actualizado', async () => {
    // Arrange
    pool.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 4, nombre: 'Fer', email: 'fer@mail.com', telefono: '351', activo: 1 }]]);

    // Act
    const resultado = await clienteModel.actualizar(4, { nombre: 'Fer', email: 'fer@mail.com', telefono: '351' });

    // Assert
    expect(resultado).toEqual({ id: 4, nombre: 'Fer', email: 'fer@mail.com', telefono: '351', activo: true });
  });
});

describe('clienteModel.desactivar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la cantidad de filas afectadas', async () => {
    // Arrange
    pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

    // Act
    const resultado = await clienteModel.desactivar(4);

    // Assert
    expect(resultado).toBe(1);
  });
});
