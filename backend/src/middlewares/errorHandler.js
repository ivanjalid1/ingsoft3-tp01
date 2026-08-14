import { AppError } from '../utils/AppError.js';

// ÚNICO lugar de todo el backend que traduce un error a una respuesta HTTP.
// Express reconoce un manejador de errores por tener cuatro parámetros:
// si le sacás `next`, deja de ser error handler y no se ejecuta nunca.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message }
    });
  }

  // Error no previsto: se loguea entero del lado del servidor y al cliente
  // le sale un mensaje genérico. El stack trace no se filtra nunca.
  console.error('[error]', err);
  return res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' }
  });
}
