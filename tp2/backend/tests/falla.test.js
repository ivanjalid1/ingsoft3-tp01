import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

// TP9 · el endpoint temporal que falla a propósito para ver el error en
// Sentry. Lo que importa del contrato: no pide token, responde 500 genérico
// (el errorHandler no filtra el mensaje ni el stack) y el error llega al log.
describe('GET /api/falla (temporal, TP9)', () => {
  it('responde 500 genérico sin token y sin filtrar el mensaje interno', async () => {
    // Arrange
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const res = await request(app).get('/api/falla');

    // Assert
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('ERROR_INTERNO');
    expect(JSON.stringify(res.body)).not.toContain('Falla de prueba');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
