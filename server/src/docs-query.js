// Filtros, orden y actualizaciones con la misma semántica que Firestore, aplicados
// en memoria sobre los documentos de un campo (son cientos, no millones).
import { compareValues, getPath, nowTimestamp, valuesEqual } from './codec.js';
import { HttpError } from './access.js';

const OPS = {
  '==': (field, value) => field !== undefined && valuesEqual(field, value),
  '!=': (field, value) => field !== undefined && field !== null && !valuesEqual(field, value),
  '<': (field, value) => field !== undefined && compareValues(field, value) < 0,
  '<=': (field, value) => field !== undefined && compareValues(field, value) <= 0,
  '>': (field, value) => field !== undefined && compareValues(field, value) > 0,
  '>=': (field, value) => field !== undefined && compareValues(field, value) >= 0,
  in: (field, values) => field !== undefined && values.some((v) => valuesEqual(field, v)),
  'not-in': (field, values) => field !== undefined && field !== null && !values.some((v) => valuesEqual(field, v)),
  'array-contains': (field, value) => Array.isArray(field) && field.some((v) => valuesEqual(v, value)),
  'array-contains-any': (field, values) => Array.isArray(field) && field.some((v) => values.some((w) => valuesEqual(v, w))),
};

export function validateQuery({ where = [], orderBy = [], limit } = {}) {
  if (!Array.isArray(where) || !Array.isArray(orderBy)) throw new HttpError(400, 'Consulta inválida');
  for (const clause of where) {
    if (!Array.isArray(clause) || clause.length !== 3 || typeof clause[0] !== 'string' || !OPS[clause[1]]) {
      throw new HttpError(400, `Filtro inválido: ${JSON.stringify(clause)}`);
    }
    if (['in', 'not-in', 'array-contains-any'].includes(clause[1]) && !Array.isArray(clause[2])) {
      throw new HttpError(400, `El operador ${clause[1]} necesita una lista`);
    }
  }
  for (const clause of orderBy) {
    if (!Array.isArray(clause) || typeof clause[0] !== 'string' || !['asc', 'desc'].includes(clause[1] || 'asc')) {
      throw new HttpError(400, `Orden inválido: ${JSON.stringify(clause)}`);
    }
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) throw new HttpError(400, 'limit inválido');
}

export function runQuery(docs, { where = [], orderBy = [], limit } = {}) {
  let result = docs.filter(({ data }) => where.every(([path, op, value]) => OPS[op](getPath(data, path), value)));
  if (orderBy.length) {
    // Igual que Firestore: los documentos sin el campo de orden no aparecen.
    result = result.filter(({ data }) => orderBy.every(([path]) => getPath(data, path) !== undefined));
    result.sort((a, b) => {
      for (const [path, dir = 'asc'] of orderBy) {
        const cmp = compareValues(getPath(a.data, path), getPath(b.data, path));
        if (cmp) return dir === 'desc' ? -cmp : cmp;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  } else {
    result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return limit === undefined ? result : result.slice(0, limit);
}

function isSentinel(value, type) {
  return value !== null && typeof value === 'object' && value.__t === type;
}

// Reemplaza {__t:'serverTs'} por la hora del servidor, en cualquier nivel.
export function materialize(value) {
  if (isSentinel(value, 'serverTs')) return nowTimestamp();
  if (Array.isArray(value)) return value.map(materialize);
  if (value !== null && typeof value === 'object') {
    if (['delete', 'arrayUnion', 'arrayRemove'].includes(value.__t)) {
      throw new HttpError(400, `${value.__t} solo se puede usar en update`);
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, materialize(v)]));
  }
  return value;
}

// updateDoc de Firestore: claves con punto = paths anidados, más los sentinels.
export function applyUpdate(data, updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw new HttpError(400, 'Update inválido');
  const out = structuredClone(data);
  for (const [path, value] of Object.entries(updates)) {
    const keys = path.split('.');
    const last = keys.pop();
    let parent = out;
    for (const key of keys) {
      if (parent[key] === null || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {};
      parent = parent[key];
    }
    if (isSentinel(value, 'delete')) {
      delete parent[last];
    } else if (isSentinel(value, 'arrayUnion')) {
      const current = Array.isArray(parent[last]) ? parent[last] : [];
      const toAdd = materialize(value.values || []);
      parent[last] = [...current, ...toAdd.filter((v, i) => !current.some((c) => valuesEqual(c, v)) && toAdd.findIndex((w) => valuesEqual(w, v)) === i)];
    } else if (isSentinel(value, 'arrayRemove')) {
      const current = Array.isArray(parent[last]) ? parent[last] : [];
      parent[last] = current.filter((c) => !(value.values || []).some((v) => valuesEqual(c, v)));
    } else {
      parent[last] = materialize(value);
    }
  }
  return out;
}
