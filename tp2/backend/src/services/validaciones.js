import { AppError } from '../utils/AppError.js';

// Un id de ruta inválido (NaN, decimal, cero, negativo) no puede llegar a una
// query: mysql2 lo pasaría tal cual al driver y el error crudo caería en el
// branch genérico del errorHandler como 500. Se corta acá, antes de tocar el
// model, para que siempre sea un 400 de dominio. Compartida entre clientes,
// productos y ventas porque los tres validaban el mismo id de la misma forma.
export function validarId(id) {
  if (!esEnteroPositivo(id)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El id debe ser un número entero positivo');
  }
}

// El predicado suelto, sin lanzar. `validarId` cubre el caso "es un id y el
// mensaje da igual"; ventaService valida tres campos distintos (cliente_id,
// producto_id, cantidad) que necesitan cada uno su propio mensaje —y la
// cantidad, además, su propio code (CANTIDAD_INVALIDA)—, así que consume la
// condición y arma el AppError él. Antes la reimplementaba a mano tres veces
// en el mismo archivo que ya importaba este módulo.
export function esEnteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}
