import { AppError } from '../utils/AppError.js';

// Un id de ruta inválido (NaN, decimal, cero, negativo) no puede llegar a una
// query: mysql2 lo pasaría tal cual al driver y el error crudo caería en el
// branch genérico del errorHandler como 500. Se corta acá, antes de tocar el
// model, para que siempre sea un 400 de dominio. Compartida entre clientes,
// productos y ventas porque los tres validaban el mismo id de la misma forma.
export function validarId(id) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El id debe ser un número entero positivo');
  }
}
