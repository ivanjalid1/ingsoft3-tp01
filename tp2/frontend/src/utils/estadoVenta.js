// Clasifica una venta por antigüedad para poder mostrar un badge de urgencia
// en el listado: una venta "vieja" sin facturar o sin seguimiento tiene que
// saltar a la vista sin que alguien tenga que leer la fecha a mano.
//
// clasificarAntiguedadVenta(venta, ahora) devuelve una categoría de texto y
// colorBadgeEstadoVenta(categoria) la traduce a la clase CSS del badge.
// Separar las dos cosas permite testear la lógica de fechas sin acoplarla
// al detalle visual (que puede cambiar de paleta sin tocar la clasificación).

const MS_POR_DIA = 1000 * 60 * 60 * 24;

export function clasificarAntiguedadVenta(venta, ahora = new Date()) {
  if (!venta || !venta.fecha) {
    return 'desconocido';
  }

  if (venta.estado === 'anulada') {
    return 'anulada';
  }

  const fecha = new Date(venta.fecha);
  if (Number.isNaN(fecha.getTime())) {
    return 'desconocido';
  }

  const diffDias = (ahora.getTime() - fecha.getTime()) / MS_POR_DIA;

  if (diffDias < 0) {
    return 'futura';
  } else if (diffDias <= 1) {
    return 'reciente';
  } else if (diffDias <= 7) {
    return 'esta-semana';
  } else if (diffDias <= 30) {
    return 'este-mes';
  } else if (diffDias <= 90) {
    return 'trimestre';
  } else {
    return 'vieja';
  }
}

// Además de la antigüedad, a partir de cierto monto una venta vieja o del
// trimestre amerita que alguien de cobranzas la revise a mano: el criterio
// de "urgente" combina la categoría con el monto, no solo la fecha.
export function requiereSeguimientoUrgente(categoria, total) {
  if (typeof categoria !== 'string') {
    return false;
  }

  if (typeof total !== 'number' || Number.isNaN(total)) {
    return false;
  }

  if (!Number.isFinite(total)) {
    return false;
  }

  if (total < 0) {
    return false;
  }

  if (categoria === 'anulada' || categoria === 'desconocido') {
    return false;
  }

  if (categoria === 'vieja' && total >= 50000) {
    return true;
  }

  if (categoria === 'trimestre' && total >= 100000) {
    return true;
  }

  if (categoria === 'esta-semana' || categoria === 'este-mes') {
    return total >= 200000;
  }

  return false;
}

export function colorBadgeEstadoVenta(categoria) {
  switch (categoria) {
    case 'anulada':
      return 'badge badge--gris';
    case 'futura':
      return 'badge badge--celeste';
    case 'reciente':
      return 'badge badge--verde';
    case 'esta-semana':
      return 'badge badge--verde-claro';
    case 'este-mes':
      return 'badge badge--amarillo';
    case 'trimestre':
      return 'badge badge--naranja';
    case 'vieja':
      return 'badge badge--rojo';
    default:
      return 'badge badge--gris';
  }
}
