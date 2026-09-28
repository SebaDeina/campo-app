import { describe, it, expect } from 'vitest';
import { addCampo, loginAs, makeApp } from './helpers.js';
import { putDoc } from '../src/store.js';
import { runQuery, applyUpdate } from '../src/docs-query.js';

const H = { 'X-Requested-With': 'campo' };
const ts = (v) => ({ __t: 'ts', v });

async function setup() {
  const ctx = makeApp();
  addCampo(ctx.db, 'c1', [['ana', 'owner'], ['vero', 'viewer']]);
  addCampo(ctx.db, 'c2', [['beto', 'owner']]);
  putDoc(ctx.db, 'ovejas', 'o1', { campoId: 'c1', numeroCaravana: '1', activa: true, reproductivo: { gestante: true } });
  putDoc(ctx.db, 'ovejas', 'o2', { campoId: 'c1', numeroCaravana: '2', activa: false });
  putDoc(ctx.db, 'ovejas', 'o3', { campoId: 'c2', numeroCaravana: '3', activa: true });
  putDoc(ctx.db, 'lluvias', 'l1', { campoId: 'c1', fecha: ts('2025-03-01T03:00:00Z'), milimetros: 10 });
  putDoc(ctx.db, 'lluvias', 'l2', { campoId: 'c1', fecha: ts('2025-01-01T03:00:00Z'), milimetros: 5 });
  putDoc(ctx.db, 'lluvias', 'l3', { campoId: 'c1', milimetros: 7 });
  return { ...ctx, ana: await loginAs(ctx.app, ctx.db, 'ana'), vero: await loginAs(ctx.app, ctx.db, 'vero'), beto: await loginAs(ctx.app, ctx.db, 'beto') };
}

describe('consultas', () => {
  it('filtra por campo, paths anidados y ordena como Firestore', async () => {
    const { ana } = await setup();
    const gestantes = await ana.post('/api/db/query').set(H).send({
      collection: 'ovejas',
      where: [['campoId', '==', 'c1'], ['activa', '==', true], ['reproductivo.gestante', '==', true]],
    }).expect(200);
    expect(gestantes.body.map((d) => d.id)).toEqual(['o1']);

    const lluvias = await ana.post('/api/db/query').set(H).send({
      collection: 'lluvias', where: [['campoId', '==', 'c1']], orderBy: [['fecha', 'desc']],
    }).expect(200);
    // l3 no tiene fecha: Firestore la excluye al ordenar por fecha.
    expect(lluvias.body.map((d) => d.id)).toEqual(['l1', 'l2']);
    expect(lluvias.body[0].data.fecha).toEqual(ts('2025-03-01T03:00:00Z'));
  });

  it('no deja leer datos de otro campo ni consultar sin filtro de campo', async () => {
    const { ana } = await setup();
    await ana.post('/api/db/query').set(H).send({ collection: 'ovejas', where: [['campoId', '==', 'c2']] }).expect(403);
    await ana.post('/api/db/query').set(H).send({ collection: 'ovejas', where: [] }).expect(400);
    await ana.post('/api/db/query').set(H).send({ collection: 'users', where: [['campoId', '==', 'c1']] }).expect(404);
    const other = await ana.get('/api/db/ovejas/o3');
    expect(other.status).toBe(403);
  });

  it('exige sesión y cuenta aprobada', async () => {
    const { app, db } = await setup();
    const request = (await import('supertest')).default;
    await request(app).post('/api/db/query').set(H).send({ collection: 'ovejas', where: [['campoId', '==', 'c1']] }).expect(401);
    const pendiente = await loginAs(app, db, 'nuevo');
    putDoc(db, 'users', 'nuevo', { isApproved: false });
    await pendiente.post('/api/db/query').set(H).send({ collection: 'ovejas', where: [['campoId', '==', 'c1']] }).expect(403);
  });
});

describe('escrituras', () => {
  it('add, update con paths y sentinels, y delete archivado', async () => {
    const { ana, db } = await setup();
    const added = await ana.post('/api/db/tareas').set(H).send({
      data: { campoId: 'c1', tipo: 'vacunacion', completada: false, createdAt: { __t: 'serverTs' } },
    }).expect(201);
    expect(added.body.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(added.body.data.createdAt.__t).toBe('ts');

    await ana.patch(`/api/db/tareas/${added.body.id}`).set(H).send({
      data: { completada: true, 'meta.nota': 'ok', tipo: { __t: 'delete' } },
    }).expect(200);
    const got = await ana.get(`/api/db/tareas/${added.body.id}`).expect(200);
    expect(got.body.data).toMatchObject({ completada: true, meta: { nota: 'ok' } });
    expect(got.body.data.tipo).toBeUndefined();

    await ana.delete(`/api/db/tareas/${added.body.id}`).set(H).expect(200);
    expect((await ana.get(`/api/db/tareas/${added.body.id}`)).body.data).toBe(null);
    const archived = db.prepare("SELECT data, deleted_by FROM deleted_docs WHERE collection = 'tareas'").get();
    expect(JSON.parse(archived.data).completada).toBe(true);
    expect(archived.deleted_by).toBe('ana');
  });

  it('viewer no escribe; nadie escribe en campos ajenos ni mueve docs de campo', async () => {
    const { ana, vero, beto } = await setup();
    await vero.post('/api/db/ovejas').set(H).send({ data: { campoId: 'c1' } }).expect(403);
    await vero.patch('/api/db/ovejas/o1').set(H).send({ data: { activa: false } }).expect(403);
    await beto.patch('/api/db/ovejas/o1').set(H).send({ data: { activa: false } }).expect(403);
    await beto.delete('/api/db/ovejas/o1').set(H).expect(403);
    await beto.put('/api/db/ovejas/o1').set(H).send({ data: { campoId: 'c2' } }).expect(403);
    await ana.patch('/api/db/ovejas/o1').set(H).send({ data: { campoId: 'c2' } }).expect(400);
    await ana.patch('/api/db/ovejas/nope').set(H).send({ data: { activa: false } }).expect(404);
  });

  it('batch es atómico', async () => {
    const { ana, db } = await setup();
    const ok = await ana.post('/api/db/batch').set(H).send({ ops: [
      { type: 'set', collection: 'lluvias', id: 'nueva1', data: { campoId: 'c1', milimetros: 3, fecha: ts('2025-05-01T03:00:00Z') } },
      { type: 'set', collection: 'lluvias', id: 'nueva2', data: { campoId: 'c1', milimetros: 4, fecha: ts('2025-05-02T03:00:00Z') } },
    ] });
    expect(ok.status).toBe(200);
    const before = db.prepare("SELECT count(*) AS n FROM docs WHERE collection = 'lluvias'").get().n;
    await ana.post('/api/db/batch').set(H).send({ ops: [
      { type: 'set', collection: 'lluvias', id: 'nueva3', data: { campoId: 'c1', milimetros: 1 } },
      { type: 'set', collection: 'lluvias', id: 'ajena', data: { campoId: 'c2', milimetros: 1 } },
    ] }).expect(403);
    expect(db.prepare("SELECT count(*) AS n FROM docs WHERE collection = 'lluvias'").get().n).toBe(before);
  });
});

describe('stock de alimento', () => {
  it('alimentos y movimientos respetan los permisos por campo', async () => {
    const { ana, vero, beto } = await setup();
    const alimento = await ana.post('/api/db/alimentos').set(H).send({
      data: { campoId: 'c1', nombre: 'Alfalfa', unidad: 'fardos', stockMinimo: 10, activo: true },
    }).expect(201);
    await ana.post('/api/db/alimentoMovimientos').set(H).send({
      data: { campoId: 'c1', alimentoId: alimento.body.id, tipo: 'ingreso', cantidad: 50, precioTotal: 250000 },
    }).expect(201);
    const movs = await vero.post('/api/db/query').set(H).send({
      collection: 'alimentoMovimientos', where: [['campoId', '==', 'c1']],
    }).expect(200);
    expect(movs.body).toHaveLength(1);
    await vero.post('/api/db/alimentoMovimientos').set(H).send({ data: { campoId: 'c1', tipo: 'consumo', cantidad: 1 } }).expect(403);
    await beto.post('/api/db/query').set(H).send({ collection: 'alimentos', where: [['campoId', '==', 'c1']] }).expect(403);
  });
});

describe('runQuery / applyUpdate', () => {
  it('soporta in, array-contains, !=, límites y orden compuesto', () => {
    const docs = [
      { id: 'a', data: { n: 1, tags: ['x'], t: 'b' } },
      { id: 'b', data: { n: 2, tags: ['y'], t: 'a' } },
      { id: 'c', data: { n: 2, tags: [], t: 'c' } },
    ];
    expect(runQuery(docs, { where: [['n', 'in', [2]]] }).map((d) => d.id)).toEqual(['b', 'c']);
    expect(runQuery(docs, { where: [['tags', 'array-contains', 'x']] }).map((d) => d.id)).toEqual(['a']);
    expect(runQuery(docs, { where: [['n', '!=', 1]] }).map((d) => d.id)).toEqual(['b', 'c']);
    expect(runQuery(docs, { orderBy: [['n', 'desc'], ['t', 'asc']], limit: 2 }).map((d) => d.id)).toEqual(['b', 'c']);
  });

  it('arrayUnion no duplica y arrayRemove saca', () => {
    const out = applyUpdate({ ids: ['a'] }, { ids: { __t: 'arrayUnion', values: ['a', 'b'] } });
    expect(out.ids).toEqual(['a', 'b']);
    expect(applyUpdate(out, { ids: { __t: 'arrayRemove', values: ['a'] } }).ids).toEqual(['b']);
  });
});
