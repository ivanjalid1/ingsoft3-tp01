import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import * as clienteModel from '../src/models/clienteModel.js';

vi.mock('../src/models/clienteModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorEmail: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn()
}));

// El mismo secreto que declara vitest.config.js.
const TOKEN = jwt.sign(
  { sub: 1, email: 'admin@erp.local' },
  'secreto-de-test',
  { algorithm: 'HS256', expiresIn: '8h' }
);

const CLIENTE_DEMO = {
  id: 1,
  nombre: 'Cliente Demo',
  email: 'demo@cliente.local',
  telefono: '3510000000',
  activo: true
};

describe('POST /api/clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 7 del TP5 — Restricción (unicidad) ────────────────────
  it('devuelve 409 EMAIL_DUPLICADO cuando el email ya existe y no inserta', async () => {
    clienteModel.buscarPorEmail.mockResolvedValue(CLIENTE_DEMO);

    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Otro', email: 'demo@cliente.local', telefono: '3511111111' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('EMAIL_DUPLICADO');
    expect(clienteModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 409 EMAIL_DUPLICADO si la base rechaza con ER_DUP_ENTRY', async () => {
    clienteModel.buscarPorEmail.mockResolvedValue(null);
    const errorDeMysql = new Error('Duplicate entry');
    errorDeMysql.code = 'ER_DUP_ENTRY';
    clienteModel.crear.mockRejectedValue(errorDeMysql);

    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Ana Pérez', email: 'ana@mail.com', telefono: '3511111111' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('EMAIL_DUPLICADO');
  });

  it('devuelve 201 con el cliente creado cuando los datos son válidos', async () => {
    clienteModel.buscarPorEmail.mockResolvedValue(null);
    clienteModel.crear.mockResolvedValue({
      id: 2, nombre: 'Ana Pérez', email: 'ana@mail.com',
      telefono: '3511111111', activo: true
    });

    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Ana Pérez', email: 'ana@mail.com', telefono: '3511111111' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: 2, nombre: 'Ana Pérez', email: 'ana@mail.com',
      telefono: '3511111111', activo: true
    });
  });

  it('devuelve 400 DATOS_INVALIDOS con el nombre vacío', async () => {
    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: '   ', email: 'ana@mail.com' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(clienteModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS con un email sin formato', async () => {
    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Ana Pérez', email: 'ana-arroba-mail' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(clienteModel.crear).not.toHaveBeenCalled();
  });
});

describe('GET /api/clientes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 CLIENTE_NO_ENCONTRADO si no existe', async () => {
    clienteModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/clientes/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('CLIENTE_NO_ENCONTRADO');
  });

  it('devuelve 400 DATOS_INVALIDOS con un id no numérico y no llega al model', async () => {
    const respuesta = await request(app)
      .get('/api/clientes/abc')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(clienteModel.buscarPorId).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/clientes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace baja lógica y devuelve activo en false', async () => {
    clienteModel.buscarPorId.mockResolvedValue(CLIENTE_DEMO);
    clienteModel.desactivar.mockResolvedValue(1);

    const respuesta = await request(app)
      .delete('/api/clientes/1')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id: 1, activo: false });
    expect(clienteModel.desactivar).toHaveBeenCalledWith(1);
  });
});
