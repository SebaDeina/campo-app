// Prueba de punta a punta del shim del frontend (src/lib/db.js) contra la app real.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addCampo, loginAs, makeApp } from './helpers.js';
import { putDoc } from '../src/store.js';
import {
  db, collection, doc, query, where, orderBy, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  writeBatch, Timestamp, serverTimestamp, deleteField,
} from '../../src/lib/db.js';

let ctx;

beforeEach(async () => {
  ctx = makeApp();
  addCampo(ctx.db, 'c1', [['ana', 'owner']]);
  putDoc(ctx.db, 'lluvias', 'l1', { campoId: 'c1', fecha: { __t: 'ts', v: '2025-03-01T03:00:00.123456Z' }, milimetros: 10 });
  const agent = await loginAs(ctx.app, ctx.db, 'ana');
  // fetch del navegador → supertest con la sesión de ana.
  vi.stubGlobal('fetch', async (url, { method = 'GET', headers = {}, body } = {}) => {
    let req = agent[method.toLowerCase()](url);
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    const res = body ? await req.send(JSON.parse(body)) : await req;
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('shim de Firestore', () => {
  it('lee con where/orderBy y revive timestamps con toDate()', async () => {
    const snap = await getDocs(query(collection(db, 'lluvias'), where('campoId', '==', 'c1'), orderBy('fecha', 'desc')));
    expect(snap.size).toBe(1);
    const data = snap.docs[0].data();
    expect(data.fecha).toBeInstanceOf(Timestamp);
    expect(data.fecha.toDate().toISOString()).toBe('2025-03-01T03:00:00.123Z');
  });

  it('re-guardar un timestamp migrado conserva los microsegundos', async () => {
    const snap = await getDoc(doc(db, 'lluvias', 'l1'));
    await updateDoc(doc(db, 'lluvias', 'l1'), { fechaCopia: snap.data().fecha });
    const row = JSON.parse(ctx.db.prepare("SELECT data FROM docs WHERE id = 'l1'").get().data);
    expect(row.fechaCopia).toEqual({ __t: 'ts', v: '2025-03-01T03:00:00.123456Z' });
  });

  it('addDoc con Date y serverTimestamp, updateDoc con deleteField, deleteDoc', async () => {
    const ref = await addDoc(collection(db, 'tareas'), {
      campoId: 'c1', fecha: new Date('2025-06-01T12:00:00Z'), createdAt: serverTimestamp(), extra: 'x', nada: undefined,
    });
    let snap = await getDoc(ref);
    expect(snap.exists()).toBe(true);
    expect(snap.data().fecha.toDate().toISOString()).toBe('2025-06-01T12:00:00.000Z');
    expect(snap.data().createdAt).toBeInstanceOf(Timestamp);
    expect('nada' in snap.data()).toBe(false);

    await updateDoc(ref, { extra: deleteField(), completada: true });
    snap = await getDoc(ref);
    expect(snap.data().extra).toBeUndefined();
    expect(snap.data().completada).toBe(true);

    await deleteDoc(ref);
    expect((await getDoc(ref)).exists()).toBe(false);
  });

  it('writeBatch con doc(collectionRef) genera ids y guarda todo junto', async () => {
    const batch = writeBatch(db);
    const a = doc(collection(db, 'lluvias'));
    const b = doc(collection(db, 'lluvias'));
    batch.set(a, { campoId: 'c1', milimetros: 1, fecha: Timestamp.fromDate(new Date('2025-07-01T03:00:00Z')) });
    batch.set(b, { campoId: 'c1', milimetros: 2, fecha: Timestamp.fromDate(new Date('2025-07-02T03:00:00Z')) });
    await batch.commit();
    expect(a.id).toMatch(/^[A-Za-z0-9]{20}$/);
    const snap = await getDocs(query(collection(db, 'lluvias'), where('campoId', '==', 'c1'), orderBy('fecha', 'asc')));
    expect(snap.docs.map((d) => d.id)).toEqual(['l1', a.id, b.id]);
  });

  it('propaga errores de permiso', async () => {
    await expect(getDocs(query(collection(db, 'ovejas'), where('campoId', '==', 'ajeno')))).rejects.toMatchObject({ status: 403 });
  });
});
