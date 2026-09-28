// Cálculos del stock de alimento (src/lib/alimento.js, usado por el frontend).
import { describe, it, expect } from 'vitest';
import {
  calcularStock, consumoPromedioDiario, diasDeReserva, gastosPorMes, deltaAjuste, stockBajo,
} from '../../src/lib/alimento.js';

const HOY = new Date('2026-09-28T15:00:00Z');
const dia = (iso) => new Date(`${iso}T12:00:00Z`);
// Imita el Timestamp del shim para comprobar que se aceptan ambos formatos.
const ts = (iso) => ({ toDate: () => dia(iso) });

describe('calcularStock', () => {
  it('es 0 sin movimientos', () => {
    expect(calcularStock([])).toBe(0);
  });

  it('suma ingresos, resta consumos y aplica ajustes con signo', () => {
    const movs = [
      { tipo: 'ingreso', cantidad: 50, fecha: ts('2026-09-01') },
      { tipo: 'consumo', cantidad: 12, fecha: dia('2026-09-10') },
      { tipo: 'ajuste', cantidad: -3, fecha: dia('2026-09-20') },
      { tipo: 'ingreso', cantidad: 0.5, fecha: dia('2026-09-21') },
    ];
    expect(calcularStock(movs)).toBe(35.5);
  });
});

describe('consumoPromedioDiario', () => {
  it('promedia los consumos de los últimos 28 días', () => {
    const movs = [
      { tipo: 'ingreso', cantidad: 100, fecha: dia('2026-06-01') },
      { tipo: 'consumo', cantidad: 28, fecha: dia('2026-09-15') },
      { tipo: 'consumo', cantidad: 28, fecha: dia('2026-09-20') },
      { tipo: 'consumo', cantidad: 500, fecha: dia('2026-08-01') }, // fuera de la ventana
    ];
    expect(consumoPromedioDiario(movs, HOY)).toBe(2);
  });

  it('en un alimento nuevo divide por los días que lleva, no por 28', () => {
    const movs = [
      { tipo: 'ingreso', cantidad: 40, fecha: dia('2026-09-24') },
      { tipo: 'consumo', cantidad: 8, fecha: dia('2026-09-26') },
      { tipo: 'consumo', cantidad: 12, fecha: dia('2026-09-28') },
    ];
    // Primer movimiento hace 4 días → ventana de 4 días.
    expect(consumoPromedioDiario(movs, HOY)).toBe(5);
  });

  it('es 0 sin consumos', () => {
    expect(consumoPromedioDiario([{ tipo: 'ingreso', cantidad: 5, fecha: dia('2026-09-01') }], HOY)).toBe(0);
    expect(consumoPromedioDiario([], HOY)).toBe(0);
  });
});

describe('diasDeReserva', () => {
  it('redondea hacia abajo', () => {
    expect(diasDeReserva(35, 2)).toBe(17);
  });

  it('es null sin consumo y 0 sin stock', () => {
    expect(diasDeReserva(35, 0)).toBe(null);
    expect(diasDeReserva(0, 2)).toBe(0);
    expect(diasDeReserva(-4, 2)).toBe(0);
  });
});

describe('gastosPorMes', () => {
  it('suma los precios de los ingresos por mes, con meses vacíos en 0', () => {
    const movs = [
      { tipo: 'ingreso', cantidad: 50, precioTotal: 250000, fecha: dia('2026-09-01') },
      { tipo: 'ingreso', cantidad: 10, precioTotal: 60000, fecha: ts('2026-09-15') },
      { tipo: 'ingreso', cantidad: 10, fecha: dia('2026-08-15') }, // sin precio
      { tipo: 'ingreso', cantidad: 10, precioTotal: 40000, fecha: dia('2026-07-03') },
      { tipo: 'consumo', cantidad: 5, precioTotal: 999, fecha: dia('2026-09-20') }, // se ignora
      { tipo: 'ingreso', cantidad: 10, precioTotal: 1, fecha: dia('2026-01-01') }, // fuera de rango
    ];
    expect(gastosPorMes(movs, HOY, 3)).toEqual([
      { mes: '2026-07', total: 40000 },
      { mes: '2026-08', total: 0 },
      { mes: '2026-09', total: 310000 },
    ]);
  });

  it('cruza el cambio de año', () => {
    expect(gastosPorMes([], new Date('2026-01-15T12:00:00Z'), 2).map((g) => g.mes)).toEqual(['2025-12', '2026-01']);
  });
});

describe('deltaAjuste / stockBajo', () => {
  it('el ajuste es la diferencia entre lo contado y lo calculado', () => {
    expect(deltaAjuste(35, 40)).toBe(5);
    expect(deltaAjuste(35, 30)).toBe(-5);
  });

  it('stock bajo solo si hay mínimo definido', () => {
    expect(stockBajo(3, 10)).toBe(true);
    expect(stockBajo(10, 10)).toBe(true);
    expect(stockBajo(11, 10)).toBe(false);
    expect(stockBajo(0, 0)).toBe(false);
  });
});
