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

  it('devuelve 400 DATOS_INVALIDOS con precio negativo y no inserta', async () => {
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: -5, stock: 30 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS con precio en cero', async () => {
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: 0, stock: 30 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS con stock negativo', async () => {
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: 9500.5, stock: -1 });

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

describe('GET /api/productos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 PRODUCTO_NO_ENCONTRADO si no existe', async () => {
    productoModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/productos/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
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
});
