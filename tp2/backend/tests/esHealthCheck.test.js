import { describe, it, expect } from 'vitest';
import { esHealthCheck } from '../src/utils/esHealthCheck.js';

describe('esHealthCheck (TP9: qué pedidos no se miden en Sentry)', () => {
  it.each(['/health', '/api/health', '/api/health/db', '/api/health?x=1'])(
    '%s es health check',
    (url) => expect(esHealthCheck(url)).toBe(true)
  );

  it.each(['/api/clientes', '/api/healthy', '/api/productos/health', '/', undefined])(
    '%s no es health check',
    (url) => expect(esHealthCheck(url)).toBe(false)
  );
});
