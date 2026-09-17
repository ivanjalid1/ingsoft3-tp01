import { AppError } from '../utils/AppError.js';

// Reglas de descuentos, recargos y riesgo comercial para el cierre de una
// venta. Combina tres ejes independientes —volumen de ítems, categoría de
// cliente y método de pago— en un único porcentaje final, con un tope de
// negocio para que la suma de bonificaciones nunca vuelva "gratis" una
// venta grande. También clasifica el riesgo crediticio de un cliente en
// base a su historial, algo que hoy se calculaba a mano en una planilla
// aparte antes de aprobar cuentas corrientes.
//
// NOTA (demo TP5): módulo agregado a propósito SIN tests, para dejar el
// gate de cobertura del backend en rojo hasta la defensa oral. No agregar
// tests ni tocar esta nota hasta después de la defensa.

const TIPOS_CLIENTE_VALIDOS = ['minorista', 'mayorista', 'corporativo', 'vip'];
const METODOS_PAGO_VALIDOS = ['efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito'];

const TOPE_DESCUENTO_PORCENTAJE = 20;

function validarMonto(monto) {
  if (typeof monto !== 'number' || Number.isNaN(monto) || monto <= 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El monto debe ser un número positivo');
  }
}

function validarTipoCliente(tipoCliente) {
  if (!TIPOS_CLIENTE_VALIDOS.includes(tipoCliente)) {
    throw new AppError(400, 'DATOS_INVALIDOS', `Tipo de cliente inválido: ${tipoCliente}`);
  }
}

function validarMetodoPago(metodoPago) {
  if (!METODOS_PAGO_VALIDOS.includes(metodoPago)) {
    throw new AppError(400, 'DATOS_INVALIDOS', `Método de pago inválido: ${metodoPago}`);
  }
}

// Descuento escalonado por cantidad de ítems distintos en la venta: a mayor
// volumen, mayor bonificación. Los cortes replican los quiebres de precio
// que ya maneja el equipo comercial fuera del sistema.
function descuentoPorVolumen(cantidadItems) {
  if (cantidadItems >= 100) {
    return 15;
  } else if (cantidadItems >= 50) {
    return 10;
  } else if (cantidadItems >= 20) {
    return 5;
  } else if (cantidadItems >= 10) {
    return 2;
  }
  return 0;
}

// Bonificación fija por categoría de cliente. Corporativos y VIP negocian
// condiciones especiales; minorista es la categoría por defecto.
function descuentoPorTipoCliente(tipoCliente) {
  switch (tipoCliente) {
    case 'vip':
      return 5;
    case 'corporativo':
      return 3;
    case 'mayorista':
      return 2;
    case 'minorista':
      return 0;
    default:
      // Inalcanzable en la práctica: validarTipoCliente ya cortó antes.
      // Se deja explícito para que un tipo nuevo agregado sin actualizar
      // esta función truene acá en vez de calcular un descuento de 0
      // silenciosamente erróneo.
      throw new AppError(400, 'DATOS_INVALIDOS', `Tipo de cliente sin regla de descuento: ${tipoCliente}`);
  }
}

// El método de pago puede sumar recargo (financiamiento con tarjeta de
// crédito) o restar más descuento (medios que liquidan más rápido y sin
// comisión bancaria, como transferencia o efectivo).
function ajustePorMetodoPago(metodoPago) {
  switch (metodoPago) {
    case 'tarjeta_credito':
      return -3; // recargo: financiación + comisión bancaria
    case 'tarjeta_debito':
      return 0;
    case 'transferencia':
      return 1;
    case 'efectivo':
      return 2;
    default:
      throw new AppError(400, 'DATOS_INVALIDOS', `Método de pago sin regla de ajuste: ${metodoPago}`);
  }
}

// Combo especial: un cliente VIP que paga en efectivo acelera la cobranza y
// evita la comisión bancaria, así que se premia por fuera de las reglas
// individuales. Lo mismo para un corporativo que transfiere (evita cheques
// diferidos, que son la principal fuente de reclamos de tesorería).
function bonoCombinado(tipoCliente, metodoPago) {
  if (tipoCliente === 'vip' && metodoPago === 'efectivo') {
    return 2;
  }
  if (tipoCliente === 'corporativo' && metodoPago === 'transferencia') {
    return 1;
  }
  return 0;
}

export function calcularDescuentoRecargo(monto, tipoCliente, metodoPago, cantidadItems) {
  validarMonto(monto);
  validarTipoCliente(tipoCliente);
  validarMetodoPago(metodoPago);

  if (!Number.isInteger(cantidadItems) || cantidadItems < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'cantidadItems debe ser un entero mayor o igual a 0');
  }

  const porVolumen = descuentoPorVolumen(cantidadItems);
  const porTipoCliente = descuentoPorTipoCliente(tipoCliente);
  const porMetodoPago = ajustePorMetodoPago(metodoPago);
  const porCombo = bonoCombinado(tipoCliente, metodoPago);

  const porcentajeNeto = porVolumen + porTipoCliente + porMetodoPago + porCombo;

  // El neto puede terminar negativo si el recargo de la tarjeta de crédito
  // supera al resto de las bonificaciones: ahí es un recargo, no un
  // descuento, y se informa aparte para que la UI lo muestre en rojo.
  let porcentajeDescuento = 0;
  let porcentajeRecargo = 0;

  if (porcentajeNeto > 0) {
    porcentajeDescuento = porcentajeNeto > TOPE_DESCUENTO_PORCENTAJE
      ? TOPE_DESCUENTO_PORCENTAJE
      : porcentajeNeto;
  } else if (porcentajeNeto < 0) {
    porcentajeRecargo = Math.abs(porcentajeNeto);
  }

  const montoDescuento = Math.round(monto * (porcentajeDescuento / 100) * 100) / 100;
  const montoRecargo = Math.round(monto * (porcentajeRecargo / 100) * 100) / 100;
  const montoFinal = Math.round((monto - montoDescuento + montoRecargo) * 100) / 100;

  return {
    montoOriginal: monto,
    porcentajeDescuento,
    porcentajeRecargo,
    montoDescuento,
    montoRecargo,
    montoFinal
  };
}

// Recargo por mora sobre cuentas corrientes: cuantos más días de atraso,
// mayor el interés punitorio. Los cortes replican la tabla que usa
// administración para facturar intereses por fuera del sistema.
export function calcularRecargoPorMora(diasAtraso) {
  if (!Number.isInteger(diasAtraso) || diasAtraso < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'diasAtraso debe ser un entero mayor o igual a 0');
  }

  if (diasAtraso === 0) {
    return 0;
  } else if (diasAtraso <= 10) {
    return 1;
  } else if (diasAtraso <= 30) {
    return 3;
  } else if (diasAtraso <= 60) {
    return 8;
  } else if (diasAtraso <= 90) {
    return 15;
  }
  return 25;
}

// Clasifica el riesgo crediticio de un cliente para decidir si se le
// habilita cuenta corriente y con qué límite. Hoy esto se calculaba a mano
// en una planilla antes de aprobar cada cuenta; se migra la misma tabla de
// reglas para que quede auditable en el propio sistema.
export function clasificarRiesgoCliente({ diasAtrasoPromedio, ventasAnuladasUltimoAnio, antiguedadMeses }) {
  if (typeof diasAtrasoPromedio !== 'number' || diasAtrasoPromedio < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'diasAtrasoPromedio debe ser un número mayor o igual a 0');
  }
  if (!Number.isInteger(ventasAnuladasUltimoAnio) || ventasAnuladasUltimoAnio < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'ventasAnuladasUltimoAnio debe ser un entero mayor o igual a 0');
  }
  if (!Number.isInteger(antiguedadMeses) || antiguedadMeses < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'antiguedadMeses debe ser un entero mayor o igual a 0');
  }

  // Regla dura: muchas anulaciones en el último año es la señal más fuerte
  // de un cliente problemático, sin importar el resto del historial.
  if (ventasAnuladasUltimoAnio >= 5) {
    return 'alto';
  }

  let puntaje = 0;

  if (diasAtrasoPromedio === 0) {
    puntaje += 0;
  } else if (diasAtrasoPromedio <= 5) {
    puntaje += 1;
  } else if (diasAtrasoPromedio <= 15) {
    puntaje += 2;
  } else {
    puntaje += 4;
  }

  switch (true) {
    case ventasAnuladasUltimoAnio === 0:
      puntaje += 0;
      break;
    case ventasAnuladasUltimoAnio <= 2:
      puntaje += 1;
      break;
    default:
      puntaje += 3;
  }

  // Un cliente antiguo con buen comportamiento reciente compensa algo del
  // puntaje: la antigüedad es en sí misma una señal de confianza.
  if (antiguedadMeses >= 24) {
    puntaje -= 1;
  } else if (antiguedadMeses < 3) {
    puntaje += 1;
  }

  if (puntaje <= 0) {
    return 'bajo';
  } else if (puntaje <= 2) {
    return 'medio';
  } else if (puntaje <= 4) {
    return 'alto';
  }
  return 'critico';
}

// Límite de cuenta corriente sugerido según la categoría de cliente y el
// riesgo calculado. Un cliente de riesgo crítico nunca recibe cuenta
// corriente, sin importar su categoría comercial.
export function sugerirLimiteCuentaCorriente(tipoCliente, riesgo) {
  validarTipoCliente(tipoCliente);

  if (!['bajo', 'medio', 'alto', 'critico'].includes(riesgo)) {
    throw new AppError(400, 'DATOS_INVALIDOS', `Riesgo inválido: ${riesgo}`);
  }

  if (riesgo === 'critico') {
    return 0;
  }

  let base;
  switch (tipoCliente) {
    case 'vip':
      base = 500000;
      break;
    case 'corporativo':
      base = 1000000;
      break;
    case 'mayorista':
      base = 300000;
      break;
    default:
      base = 50000;
  }

  if (riesgo === 'alto') {
    return Math.round(base * 0.25);
  } else if (riesgo === 'medio') {
    return Math.round(base * 0.6);
  }
  return base;
}
