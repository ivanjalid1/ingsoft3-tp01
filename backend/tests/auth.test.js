import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import * as usuarioModel from '../src/models/usuarioModel.js';

// La capa models/ se mockea entera: estos tests no necesitan MySQL.
vi.mock('../src/models/usuarioModel.js', () => ({
  buscarPorEmailConHash: vi.fn()
}));

// Hash REAL de 'Admin123!' con cost 10. Se calcula una vez al cargar el archivo
// y hace que el test ejercite bcrypt de verdad, no un doble.
const HASH_ADMIN = bcrypt.hashSync('Admin123!', 10);

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 8 del TP5 — Autorización ──────────────────────────────
  it('devuelve 401 con la contraseña incorrecta y no filtra el password_hash', async () => {
    usuarioModel.buscarPorEmailConHash.mockResolvedValue({
      id: 1,
      email: 'admin@erp.local',
      password_hash: HASH_ADMIN
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.local', password: 'contraseña-mal' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('CREDENCIALES_INVALIDAS');
    // La segunda mitad del test: el hash no aparece por ningún lado del body.
    expect(JSON.stringify(respuesta.body)).not.toContain('password_hash');
    expect(JSON.stringify(respuesta.body)).not.toContain(HASH_ADMIN);
  });

  it('devuelve 401 con el mismo code cuando el email no existe', async () => {
    usuarioModel.buscarPorEmailConHash.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@erp.local', password: 'Admin123!' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('devuelve 200 con token y usuario sin hash cuando las credenciales son válidas', async () => {
    usuarioModel.buscarPorEmailConHash.mockResolvedValue({
      id: 1,
      email: 'admin@erp.local',
      password_hash: HASH_ADMIN
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.local', password: 'Admin123!' });

    expect(respuesta.status).toBe(200);
    expect(typeof respuesta.body.token).toBe('string');
    expect(respuesta.body.usuario).toEqual({ id: 1, email: 'admin@erp.local' });
    expect(respuesta.body.usuario.password_hash).toBeUndefined();
  });

  it('devuelve 400 si falta el password', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.local' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(usuarioModel.buscarPorEmailConHash).not.toHaveBeenCalled();
  });
});

// ── Test extra (no cuenta para los 8, pero cubre el middleware) ────
describe('middlewares/auth', () => {
  it('rechaza con 401 TOKEN_FALTANTE un endpoint protegido sin header', async () => {
    const respuesta = await request(app).get('/api/clientes');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('TOKEN_FALTANTE');
  });

  it('rechaza con 401 TOKEN_INVALIDO un token que no verifica', async () => {
    const respuesta = await request(app)
      .get('/api/clientes')
      .set('Authorization', 'Bearer esto-no-es-un-jwt');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('TOKEN_INVALIDO');
  });
});
