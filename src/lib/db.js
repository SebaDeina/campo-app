// Reemplazo de 'firebase/firestore' con la misma API que usan las páginas,
// pero contra el servidor propio (/api/db). Así las páginas solo cambian el import.
import { api } from './api';

export const db = { kind: 'campo-db' };

// --- Timestamp -------------------------------------------------------------

export class Timestamp {
  constructor(seconds, nanoseconds, iso) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
    // ISO original del servidor: se devuelve tal cual al volver a guardar, para
    // no perder la precisión de microsegundos de los datos migrados.
    this._iso = iso || null;
  }

  static fromDate(date) {
    const ms = date.getTime();
    const seconds = Math.floor(ms / 1000);
    return new Timestamp(seconds, (ms - seconds * 1000) * 1e6);
  }

  static fromMillis(ms) {
    return Timestamp.fromDate(new Date(ms));
  }

  static now() {
    return Timestamp.fromDate(new Date());
  }

  static fromIso(iso) {
    const ms = Date.parse(iso.replace(/\.\d+Z$/, 'Z'));
    const frac = /\.(\d+)Z$/.exec(iso);
    const nanos = frac ? Number(frac[1].padEnd(9, '0').slice(0, 9)) : 0;
    return new Timestamp(Math.floor(ms / 1000), nanos, iso);
  }

  toMillis() {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toDate() {
    return new Date(this.toMillis());
  }

  isEqual(other) {
    return other instanceof Timestamp && other.seconds === this.seconds && other.nanoseconds === this.nanoseconds;
  }

  valueOf() {
    return this.toMillis();
  }

  toJSON() {
    return { __t: 'ts', v: this._iso || this.toDate().toISOString() };
  }
}

// --- Sentinels ---------------------------------------------------------------

export const serverTimestamp = () => ({ __t: 'serverTs' });
export const deleteField = () => ({ __t: 'delete' });
export const arrayUnion = (...values) => ({ __t: 'arrayUnion', values: encode(values) });
export const arrayRemove = (...values) => ({ __t: 'arrayRemove', values: encode(values) });

// --- Conversión ---------------------------------------------------------------

function encode(value) {
  if (value instanceof Timestamp) return value.toJSON();
  if (value instanceof Date) return { __t: 'ts', v: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (v !== undefined) out[key] = encode(v);
    }
    return out;
  }
  return value;
}

function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (value !== null && typeof value === 'object') {
    if (value.__t === 'ts') return Timestamp.fromIso(value.v);
    const out = {};
    for (const [key, v] of Object.entries(value)) out[key] = revive(v);
    return out;
  }
  return value;
}

// --- Referencias y consultas --------------------------------------------------

const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function autoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => AUTO_ID_CHARS[b % AUTO_ID_CHARS.length]).join('');
}

export function collection(_db, path) {
  return { type: 'collection', path };
}

// doc(db, 'coleccion', id) | doc(collectionRef) | doc(collectionRef, id)
export function doc(parent, path, id) {
  if (parent?.type === 'collection') return { type: 'doc', collection: parent.path, id: path ?? autoId() };
  return { type: 'doc', collection: path, id };
}

export const where = (field, op, value) => ({ kind: 'where', clause: [field, op, encode(value)] });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', clause: [field, dir] });
export const limit = (n) => ({ kind: 'limit', n });

export function query(collectionRef, ...constraints) {
  return {
    type: 'query',
    path: collectionRef.path,
    where: constraints.filter((c) => c.kind === 'where').map((c) => c.clause),
    orderBy: constraints.filter((c) => c.kind === 'orderBy').map((c) => c.clause),
    limit: constraints.find((c) => c.kind === 'limit')?.n,
  };
}

function docSnapshot(ref, data) {
  const revived = data == null ? undefined : revive(data);
  return {
    id: ref.id,
    ref,
    exists: () => revived !== undefined,
    data: () => revived,
  };
}

// --- Lecturas y escrituras ------------------------------------------------------

export async function getDocs(q) {
  const target = q.type === 'query' ? q : query(q);
  const rows = await api('/db/query', {
    method: 'POST',
    body: { collection: target.path, where: target.where, orderBy: target.orderBy, limit: target.limit },
  });
  const docs = rows.map((row) => docSnapshot({ type: 'doc', collection: target.path, id: row.id }, row.data));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn) => docs.forEach(fn),
  };
}

export async function getDoc(ref) {
  const row = await api(`/db/${ref.collection}/${ref.id}`);
  return docSnapshot(ref, row.data);
}

export async function addDoc(collectionRef, data) {
  const row = await api(`/db/${collectionRef.path}`, { method: 'POST', body: { data: encode(data) } });
  return { type: 'doc', collection: collectionRef.path, id: row.id };
}

export async function setDoc(ref, data) {
  await api(`/db/${ref.collection}/${ref.id}`, { method: 'PUT', body: { data: encode(data) } });
}

export async function updateDoc(ref, data) {
  await api(`/db/${ref.collection}/${ref.id}`, { method: 'PATCH', body: { data: encode(data) } });
}

export async function deleteDoc(ref) {
  await api(`/db/${ref.collection}/${ref.id}`, { method: 'DELETE' });
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) {
      ops.push({ type: 'set', collection: ref.collection, id: ref.id, data: encode(data) });
      return this;
    },
    update(ref, data) {
      ops.push({ type: 'update', collection: ref.collection, id: ref.id, data: encode(data) });
      return this;
    },
    delete(ref) {
      ops.push({ type: 'delete', collection: ref.collection, id: ref.id });
      return this;
    },
    async commit() {
      await api('/db/batch', { method: 'POST', body: { ops } });
    },
  };
}
