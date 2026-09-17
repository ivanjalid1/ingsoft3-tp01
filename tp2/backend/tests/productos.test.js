import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import * as productoModel from '../src/models/productoModel.js';

vi.mock('../src/models/productoModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorIdParaActualizar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn(),
  descontarStock: vi.fn(),
  reponerStock: vi.fn()
}));

const TOKEN = jwt.sign(
  { sub: 1, email: 'admin@erp.local' },
  'secreto-de-test',
  { algorithm: 'HS256', expiresIn: '8h' }
);

describe('POST /api/productos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test parametrizado real (it.each): un mismo caso de prueba —"datos
  // inválidos rechazados con 400 y sin llegar a insertar"— corrido contra
  // varias combinaciones de campos fuera de regla. Reemplaza los tres `it`
  // casi duplicados que había antes (precio negativo / precio en cero /
  // stock negativo) y suma dos casos más (nombre vacío, stock no entero)
  // sin perder ninguna regla que ya se validaba.
  it.each([
    ['precio negativo', { nombre: 'Mouse', precio: -5, stock: 30 }],
    ['precio en cero', { nombre: 'Mouse', precio: 0, stock: 30 }],
    ['stock negativo', { nombre: 'Mouse', precio: 9500.5, stock: -1 }],
    ['nombre vacío', { nombre: '   ', precio: 9500.5, stock: 30 }],
    ['stock no entero', { nombre: 'Mouse', precio: 9500.5, stock: 1.5 }]
  ])('devuelve 400 DATOS_INVALIDOS con %s y no inserta', async (_caso, body) => {
    // Arrange: cada fila trae un body con exactamente un campo fuera de regla.
    // Act
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send(body);

    // Assert
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 201 con el producto creado cuando los datos son válidos', async () => {
    productoModel.crear.mockResolvedValue({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });

    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: 9500.5, stock: 30 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });
    expect(productoModel.crear).toHaveBeenCalledWith({
      nombre: 'Mouse', precio: 9500.5, stock: 30
    });
  });
});

describe('GET /api/productos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 200 con los productos activos por defecto', async () => {
    // Arrange
    productoModel.listar.mockResolvedValue([
      { id: 1, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true }
    ]);

    // Act
    const respuesta = await request(app)
      .get('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Assert
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(1);
    expect(productoModel.listar).toHaveBeenCalledWith(false);
  });

  it('incluye los inactivos cuando se pide incluir_inactivos=true', async () => {
    // Arrange
    productoModel.listar.mockResolvedValue([]);

    // Act
    const respuesta = await request(app)
      .get('/api/productos?incluir_inactivos=true')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Assert
    expect(respuesta.status).toBe(200);
    expect(productoModel.listar).toHaveBeenCalledWith(true);
  });

  it('devuelve 500 ERROR_INTERNO si el model falla de forma inesperada', async () => {
    // Arrange
    productoModel.listar.mockRejectedValue(new Error('conexión caída'));

    // Act
    const respuesta = await request(app)
      .get('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Assert
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.code).toBe('ERROR_INTERNO');
  });
});

describe('GET /api/productos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 200 con el producto encontrado', async () => {
    // Arrange
    productoModel.buscarPorId.mockResolvedValue({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });

    // Act
    const respuesta = await request(app)
      .get('/api/productos/3')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Assert
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });
  });

  it('devuelve 404 PRODUCTO_NO_ENCONTRADO si no existe', async () => {
    productoModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/productos/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
  });

  it('devuelve 400 DATOS_INVALIDOS con un id no numérico y no llega al model', async () => {
    const respuesta = await request(app)
      .get('/api/productos/abc')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.buscarPorId).not.toHaveBeenCalled();
  });
});

describe('PUT /api/productos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza el producto y devuelve 200 cuando los datos son válidos', async () => {
    // Arrange
    productoModel.buscarPorId.mockResolvedValue({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });
    productoModel.actualizar.mockResolvedValue({
      id: 3, nombre: 'Mouse Pro', precio: 12000, stock: 20, activo: true
    });

    // Act
    const respuesta = await request(app)
      .put('/api/productos/3')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse Pro', precio: 12000, stock: 20 });

    // Assert
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      id: 3, nombre: 'Mouse Pro', precio: 12000, stock: 20, activo: true
    });
    expect(productoModel.actualizar).toHaveBeenCalledWith(3, {
      nombre: 'Mouse Pro', precio: 12000, stock: 20
    });
  });

  it('devuelve 404 PRODUCTO_NO_ENCONTRADO al actualizar uno inexistente', async () => {
    // Arrange
    productoModel.buscarPorId.mockResolvedValue(null);

    // Act
    const respuesta = await request(app)
      .put('/api/productos/99')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse Pro', precio: 12000, stock: 20 });

    // Assert
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
    expect(productoModel.actualizar).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS al actualizar con precio inválido y no llega al model', async () => {
    // Arrange / Act
    const respuesta = await request(app)
      .put('/api/productos/3')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse Pro', precio: -1, stock: 20 });

    // Assert
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.buscarPorId).not.toHaveBeenCalled();
    expect(productoModel.actualizar).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/productos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace baja lógica y devuelve activo en false', async () => {
    productoModel.buscarPorId.mockResolvedValue({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });
    productoModel.desactivar.mockResolvedValue(1);

    const respuesta = await request(app)
      .delete('/api/productos/3')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id: 3, activo: false });
    expect(productoModel.desactivar).toHaveBeenCalledWith(3);
  });

  it('devuelve 404 PRODUCTO_NO_ENCONTRADO al desactivar uno inexistente', async () => {
    // Arrange
    productoModel.buscarPorId.mockResolvedValue(null);

    // Act
    const respuesta = await request(app)
      .delete('/api/productos/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Assert
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
    expect(productoModel.desactivar).not.toHaveBeenCalled();
  });
});
