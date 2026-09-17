import { describe, it, expect } from 'vitest';
import {
  clasificarAntiguedadVenta,
  colorBadgeEstadoVenta,
  requiereSeguimientoUrgente
} from '../src/utils/estadoVenta.js';

// Fecha de referencia fija para no depender de "ahora": todas las cuentas de
// antigüedad se hacen contra este instante.
const AHORA = new Date('2024-06-15T12:00:00Z');

function ventaConFecha(fecha, extra = {}) {
  return { id: 1, fecha, ...extra };
}

describe('clasificarAntiguedadVenta', () => {
  it('devuelve "desconocido" cuando no recibe una venta', () => {
    // Arrange
    const venta = null;

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('desconocido');
  });

  it('devuelve "desconocido" cuando la venta no tiene fecha', () => {
    // Arrange
    const venta = { id: 1 };

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('desconocido');
  });

  it('devuelve "desconocido" cuando la fecha no es parseable', () => {
    // Arrange
    const venta = ventaConFecha('no-es-una-fecha');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('desconocido');
  });

  it('devuelve "anulada" para una venta anulada, sin importar la fecha', () => {
    // Arrange
    const venta = ventaConFecha('2024-06-15T11:00:00Z', { estado: 'anulada' });

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('anulada');
  });

  it('devuelve "futura" cuando la fecha es posterior al momento de referencia', () => {
    // Arrange
    const venta = ventaConFecha('2024-06-16T12:00:00Z');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('futura');
  });

  it('devuelve "reciente" para una venta de hace menos de un día', () => {
    // Arrange
    const venta = ventaConFecha('2024-06-15T00:00:00Z');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('reciente');
  });

  it('devuelve "esta-semana" para una venta de hace 5 días', () => {
    // Arrange
    const venta = ventaConFecha('2024-06-10T12:00:00Z');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('esta-semana');
  });

  it('devuelve "este-mes" para una venta de hace 20 días', () => {
    // Arrange
    const venta = ventaConFecha('2024-05-26T12:00:00Z');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('este-mes');
  });

  it('devuelve "trimestre" para una venta de hace 60 días', () => {
    // Arrange
    const venta = ventaConFecha('2024-04-16T12:00:00Z');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('trimestre');
  });

  it('devuelve "vieja" para una venta de hace más de 90 días', () => {
    // Arrange
    const venta = ventaConFecha('2023-01-01T12:00:00Z');

    // Act
    const categoria = clasificarAntiguedadVenta(venta, AHORA);

    // Assert
    expect(categoria).toBe('vieja');
  });

  it('usa la fecha actual como valor por defecto cuando no se pasa "ahora"', () => {
    // Arrange
    const venta = ventaConFecha(new Date().toISOString());

    // Act
    const categoria = clasificarAntiguedadVenta(venta);

    // Assert
    expect(categoria).toBe('reciente');
  });
});

describe('colorBadgeEstadoVenta', () => {
  it.each([
    ['anulada', 'badge badge--gris'],
    ['futura', 'badge badge--celeste'],
    ['reciente', 'badge badge--verde'],
    ['esta-semana', 'badge badge--verde-claro'],
    ['este-mes', 'badge badge--amarillo'],
    ['trimestre', 'badge badge--naranja'],
    ['vieja', 'badge badge--rojo']
  ])('mapea la categoría "%s" a la clase "%s"', (categoria, claseEsperada) => {
    // Act
    const clase = colorBadgeEstadoVenta(categoria);

    // Assert
    expect(clase).toBe(claseEsperada);
  });

  it('devuelve el badge gris por defecto ante una categoría desconocida', () => {
    // Arrange
    const categoria = 'algo-que-no-existe';

    // Act
    const clase = colorBadgeEstadoVenta(categoria);

    // Assert
    expect(clase).toBe('badge badge--gris');
  });
});

describe('requiereSeguimientoUrgente', () => {
  it('devuelve false cuando la categoría no es un string', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente(null, 60000)).toBe(false);
  });

  it('devuelve false cuando el total no es un número', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('vieja', '60000')).toBe(false);
  });

  it('devuelve false cuando el total es NaN', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('vieja', Number.NaN)).toBe(false);
  });

  it('devuelve false cuando el total no es finito', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('vieja', Infinity)).toBe(false);
  });

  it('devuelve false cuando el total es negativo', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('vieja', -100)).toBe(false);
  });

  it('devuelve false para una venta anulada, sin importar el monto', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('anulada', 999999)).toBe(false);
  });

  it('devuelve false para una categoría desconocida, sin importar el monto', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('desconocido', 999999)).toBe(false);
  });

  it('devuelve true para una venta vieja con monto alto (>= 50000)', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('vieja', 50000)).toBe(true);
  });

  it('devuelve false para una venta vieja con monto bajo (< 50000)', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('vieja', 10000)).toBe(false);
  });

  it('devuelve true para una venta del trimestre con monto alto (>= 100000)', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('trimestre', 100000)).toBe(true);
  });

  it('devuelve false para una venta del trimestre con monto bajo (< 100000)', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('trimestre', 50000)).toBe(false);
  });

  it('devuelve true para una venta de esta semana con monto muy alto (>= 200000)', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('esta-semana', 200000)).toBe(true);
  });

  it('devuelve true para una venta de este mes con monto muy alto (>= 200000)', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('este-mes', 250000)).toBe(true);
  });

  it('devuelve false para una venta de esta semana con monto por debajo de 200000', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('esta-semana', 5000)).toBe(false);
  });

  it('devuelve false para una venta reciente, categoría sin regla de urgencia', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('reciente', 999999)).toBe(false);
  });

  it('devuelve false para una venta futura, categoría sin regla de urgencia', () => {
    // Act & Assert
    expect(requiereSeguimientoUrgente('futura', 999999)).toBe(false);
  });
});
