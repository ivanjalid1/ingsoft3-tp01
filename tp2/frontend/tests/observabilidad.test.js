import { describe, it, expect } from 'vitest';
import { opcionesSentry, SENTRY_DSN_FRONT } from '../src/observabilidad.js';

// TP9 · la misma imagen corre en QA y PROD: lo que se prueba es que SÓLO
// producción mande datos a Sentry (el pipeline no ensucia las métricas).
describe('opcionesSentry', () => {
  it('en PROD está activo, con environment production', () => {
    const o = opcionesSentry('prod.testingwebapp.site');
    expect(o.enabled).toBe(true);
    expect(o.environment).toBe('production');
    expect(o.dsn).toBe(SENTRY_DSN_FRONT);
  });

  it.each(['qa.testingwebapp.site', 'localhost', '127.0.0.1'])(
    'en %s queda apagado',
    (host) => {
      expect(opcionesSentry(host).enabled).toBe(false);
    }
  );

  it('propaga la traza sólo a la api del mismo origen', () => {
    const [patron] = opcionesSentry('prod.testingwebapp.site').tracePropagationTargets;
    expect(patron.test('/api/clientes')).toBe(true);
    expect(patron.test('https://otro.sitio/api/x')).toBe(false);
  });
});
