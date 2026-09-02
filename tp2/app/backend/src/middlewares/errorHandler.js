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

  // Body con JSON malformado. body-parser (el `express.json()` de app.js) lanza
  // un SyntaxError marcado con `type: 'entity.parse.failed'`, que no es un
  // AppError y caía al branch genérico como 500. Es un error del CLIENTE y es
  // previsible: le corresponde el mismo 400 DATOS_INVALIDOS que a cualquier otro
  // dato mal formado. El `type` se chequea además del instanceof para no
  // convertir en 400 un SyntaxError que venga de cualquier otro lado.
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'DATOS_INVALIDOS', message: 'El body no es JSON válido' }
    });
  }

  // Error no previsto: se loguea entero del lado del servidor y al cliente
  // le sale un mensaje genérico. El stack trace no se filtra nunca.
  console.error('[error]', err);
  return res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' }
  });
}
