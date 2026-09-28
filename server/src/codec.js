// Conversión entre valores de la API REST de Firestore y el JSON que guardamos.
// Los tipos que JSON no tiene (timestamps, referencias, etc.) se guardan
// etiquetados con `__t` para no perder información.

export function decodeFields(fields = {}) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) out[key] = decodeValue(value);
  return out;
}

export function decodeValue(value) {
  const [type] = Object.keys(value);
  const v = value[type];
  switch (type) {
    case 'nullValue': return null;
    case 'booleanValue': return v;
    case 'stringValue': return v;
    case 'integerValue': {
      const n = Number(v);
      return Number.isSafeInteger(n) ? n : { __t: 'int', v: String(v) };
    }
    case 'doubleValue':
      return typeof v === 'number' && Number.isFinite(v) ? v : { __t: 'double', v: String(v) };
    case 'timestampValue': return { __t: 'ts', v };
    case 'referenceValue': return { __t: 'ref', v };
    case 'bytesValue': return { __t: 'bytes', v };
    case 'geoPointValue': return { __t: 'geo', lat: v.latitude ?? 0, lng: v.longitude ?? 0 };
    case 'arrayValue': return (v.values || []).map(decodeValue);
    case 'mapValue': return decodeFields(v.fields || {});
    default: throw new Error(`Tipo de Firestore desconocido: ${type}`);
  }
}

export function isTimestamp(value) {
  return value !== null && typeof value === 'object' && value.__t === 'ts';
}

// Instante de un timestamp RFC3339 como [milisegundos, nanosegundos extra],
// para comparar sin perder la precisión de microsegundos de Firestore.
function timestampParts(iso) {
  const match = /\.(\d+)Z$/.exec(iso);
  const frac = match ? match[1].padEnd(9, '0').slice(0, 9) : '000000000';
  return [Date.parse(iso.replace(/\.\d+Z$/, 'Z')), Number(frac)];
}

export function nowTimestamp() {
  return { __t: 'ts', v: new Date().toISOString() };
}

export function getPath(obj, path) {
  let cur = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

const TYPE_ORDER = ['null', 'boolean', 'number', 'ts', 'string', 'other'];

function typeRank(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return 2;
  if (isTimestamp(value)) return 3;
  if (typeof value === 'string') return 4;
  return TYPE_ORDER.length - 1;
}

// Orden al estilo Firestore: primero por tipo, después por valor.
export function compareValues(a, b) {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 3) {
    const [ma, na] = timestampParts(a.v);
    const [mb, nb] = timestampParts(b.v);
    return ma - mb || na - nb;
  }
  if (ra === 2 || ra === 1) return Number(a) - Number(b);
  if (ra === 4) return a < b ? -1 : a > b ? 1 : 0;
  return JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0;
}

export function valuesEqual(a, b) {
  if (isTimestamp(a) && isTimestamp(b)) return compareValues(a, b) === 0;
  return JSON.stringify(a) === JSON.stringify(b);
}
