import * as Sentry from '@sentry/node';

// TP9 · Sentry: errores, tiempos y uso del backend.
//
// Se carga ANTES que el resto de la app (`node --import ./src/instrument.js`):
// Sentry instrumenta express y mysql2 al importarlos, así que tiene que
// iniciarse primero.
//
// El DSN llega por el entorno y SOLO lo tiene PROD (su .env en el VPS). Sin
// SENTRY_DSN (local, tests, QA, preprod) el SDK queda apagado y la app anda
// igual: QA no ensucia los datos de producción con las corridas del pipeline.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.SENTRY_ENVIRONMENT || 'local',
  release: process.env.APP_VERSION || undefined, // el sha que corre, el mismo de /api/health
  tracesSampleRate: 1.0,                         // medir todos los pedidos: el tráfico es chico
  sendDefaultPii: false                          // no mandar IPs ni headers de los usuarios
});
