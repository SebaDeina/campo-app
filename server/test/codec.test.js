import { describe, it, expect } from 'vitest';
import { decodeFields, decodeValue, compareValues, getPath } from '../src/codec.js';

describe('decodeValue', () => {
  it('decodifica escalares', () => {
    expect(decodeValue({ nullValue: null })).toBe(null);
    expect(decodeValue({ booleanValue: true })).toBe(true);
    expect(decodeValue({ integerValue: '42' })).toBe(42);
    expect(decodeValue({ doubleValue: 2.5 })).toBe(2.5);
    expect(decodeValue({ stringValue: 'hola' })).toBe('hola');
  });

  it('etiqueta timestamps y tipos especiales sin perder información', () => {
    expect(decodeValue({ timestampValue: '2025-11-09T14:06:38.330123Z' }))
      .toEqual({ __t: 'ts', v: '2025-11-09T14:06:38.330123Z' });
    expect(decodeValue({ referenceValue: 'projects/p/databases/(default)/documents/a/b' }))
      .toEqual({ __t: 'ref', v: 'projects/p/databases/(default)/documents/a/b' });
    expect(decodeValue({ geoPointValue: { latitude: -34.6, longitude: -58.4 } }))
      .toEqual({ __t: 'geo', lat: -34.6, lng: -58.4 });
    expect(decodeValue({ bytesValue: 'AAE=' })).toEqual({ __t: 'bytes', v: 'AAE=' });
  });

  it('preserva enteros fuera del rango seguro y dobles no finitos', () => {
    expect(decodeValue({ integerValue: '9007199254740993' })).toEqual({ __t: 'int', v: '9007199254740993' });
    expect(decodeValue({ doubleValue: 'NaN' })).toEqual({ __t: 'double', v: 'NaN' });
  });

  it('decodifica mapas y arrays anidados (incluso vacíos)', () => {
    const fields = {
      reproductivo: { mapValue: { fields: { gestante: { booleanValue: false } } } },
      peso: { arrayValue: { values: [{ mapValue: { fields: { kg: { doubleValue: 41.5 } } } }] } },
      enfermedades: { arrayValue: {} },
      vacio: { mapValue: {} },
    };
    expect(decodeFields(fields)).toEqual({
      reproductivo: { gestante: false },
      peso: [{ kg: 41.5 }],
      enfermedades: [],
      vacio: {},
    });
  });

  it('falla ante un tipo desconocido en vez de descartarlo', () => {
    expect(() => decodeValue({ fooValue: 1 })).toThrow(/desconocido/);
  });
});

describe('getPath / compareValues', () => {
  it('lee paths con punto', () => {
    expect(getPath({ reproductivo: { gestante: true } }, 'reproductivo.gestante')).toBe(true);
    expect(getPath({ a: 1 }, 'b.c')).toBe(undefined);
  });

  it('ordena timestamps por instante, no por texto', () => {
    const a = { __t: 'ts', v: '2025-01-01T00:00:00.5Z' };
    const b = { __t: 'ts', v: '2025-01-01T00:00:00.123456Z' };
    expect(compareValues(a, b)).toBeGreaterThan(0);
    expect(compareValues(b, a)).toBeLessThan(0);
    expect(compareValues(a, { __t: 'ts', v: '2025-01-01T00:00:00.500Z' })).toBe(0);
  });

  it('compara números y strings', () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues('b', 'a')).toBeGreaterThan(0);
  });
});
