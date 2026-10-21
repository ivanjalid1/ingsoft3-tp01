import * as Sentry from '@sentry/react';
import { entornoDesdeHostname } from './utils/entorno.js';

// TP9 · Sentry en el front: errores del navegador, tiempos de carga y uso.
//
// El DSN va escrito en el código A PROPÓSITO: el de un front no es un secreto.
// Sólo sirve para ENVIAR eventos al proyecto, no para leerlos, y de todos
// modos viaja en el JavaScript que baja cualquier navegador. (Una clave de
// API de Sentry sí sería un secreto: ésa no está en ningún lado del repo.)
export const SENTRY_DSN_FRONT =
  'https://c16102860f9cc6660ec1f832bfbf8969@o4512291659448320.ingest.us.sentry.io/4512291689005057';

// Función pura (testeable sin navegador): la MISMA imagen corre en QA y en
// PROD, así que el entorno se decide por el hostname, como el pie de versión.
// Sólo PROD manda datos: las corridas e2e del pipeline contra QA no ensucian
// las métricas de uso real.
export function opcionesSentry(hostname) {
  const entorno = entornoDesdeHostname(hostname);
  return {
    dsn: SENTRY_DSN_FRONT,
    enabled: entorno === 'PROD',
    environment: entorno === 'PROD' ? 'production' : entorno.toLowerCase(),
    tracesSampleRate: 1.0,       // medir todas las cargas y pedidos: el tráfico es chico
    sendDefaultPii: false,       // no mandar IPs ni datos del usuario
    // Propaga la traza al backend (mismo origen, /api): Sentry une la carga de
    // la página con el pedido a la api y la consulta a la base.
    tracePropagationTargets: [/^\/api\//]
  };
}

export function iniciarSentry(hostname = window.location.hostname) {
  Sentry.init({
    ...opcionesSentry(hostname),
    integrations: [Sentry.browserTracingIntegration()]
  });
}
