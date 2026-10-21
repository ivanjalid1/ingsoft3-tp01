// TP9 · ¿Este pedido es un health check? (/health, /api/health, /api/health/db)
// Lo usa instrument.js para no medirlos en Sentry. Función pura y aparte de
// instrument.js para poder testearla sin iniciar el SDK.
export function esHealthCheck(url) {
  return typeof url === 'string' && /^(\/api)?\/health(\/|\?|$)/.test(url);
}
