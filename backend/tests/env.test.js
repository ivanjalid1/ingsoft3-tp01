import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { faltantesDeEnv, REQUERIDAS } from '../src/config/env.js';
import app from '../src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envModulePath = path.join(__dirname, '../src/config/env.js');

describe('config/env', () => {
  it('el arranque muere nombrando la variable que falta', () => {
    // Copia todas las variables del entorno de test salvo PORT, que se
    // omite a propósito para forzar el chequeo de arranque.
    const envCompleto = Object.fromEntries(
      REQUERIDAS.map((clave) => [clave, 'valor-de-test'])
    );
    delete envCompleto.PORT;

    const envHijo = { ...process.env, ...envCompleto };
    delete envHijo.PORT;

    let error;
    try {
      execFileSync(process.execPath, [envModulePath], {
        env: envHijo,
        stdio: 'pipe'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(error.stderr.toString()).toContain('PORT');
  });

  it('devuelve las variables que faltan', () => {
    expect(faltantesDeEnv({ DB_HOST: 'localhost' })).toEqual([
      'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'PORT'
    ]);
  });

  it('no devuelve nada cuando están todas', () => {
    const completo = Object.fromEntries(REQUERIDAS.map((clave) => [clave, 'valor']));
    expect(faltantesDeEnv(completo)).toEqual([]);
  });

  it('trata el string vacío como faltante', () => {
    const completo = Object.fromEntries(REQUERIDAS.map((clave) => [clave, 'valor']));
    expect(faltantesDeEnv({ ...completo, JWT_SECRET: '' })).toEqual(['JWT_SECRET']);
  });
});

describe('GET /health', () => {
  it('devuelve 200 y status ok', async () => {
    const respuesta = await request(app).get('/health');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ status: 'ok' });
  });
});
