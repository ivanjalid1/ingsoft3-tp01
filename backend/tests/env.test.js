import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

    // El hijo corre en un directorio temporal RECIÉN CREADO Y VACÍO. `env.js`
    // empieza con `import 'dotenv/config'`, y dotenv lee
    // `path.resolve(process.cwd(), '.env')`: si el hijo heredara el cwd de
    // vitest (`backend/`), el `.env` que el README manda crear le repondría
    // PORT y el proceso saldría con 0, haciendo pasar el test por la razón
    // equivocada. Con un cwd vacío no hay `.env` que leer y el test mide lo
    // que dice medir, con o sin `backend/.env` en la máquina del que lo corre.
    const directorioSinEnv = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-env-test-'));

    let error;
    try {
      execFileSync(process.execPath, [envModulePath], {
        cwd: directorioSinEnv,
        env: envHijo,
        stdio: 'pipe'
      });
    } catch (e) {
      error = e;
    } finally {
      fs.rmSync(directorioSinEnv, { recursive: true, force: true });
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
