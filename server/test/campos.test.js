import { describe, it, expect } from 'vitest';
import { addCampo, loginAs, makeApp } from './helpers.js';
import { getDoc, putDoc } from '../src/store.js';

const H = { 'X-Requested-With': 'campo' };

describe('campos', () => {
  it('crea un campo con el usuario como owner y lo lista', async () => {
    const { app, db } = makeApp();
    const ana = await loginAs(app, db, 'ana');
    putDoc(db, 'users', 'ana', { isApproved: true });
    const created = await ana.post('/api/campos').set(H).send({ nombre: '  La Loma ' }).expect(201);
    expect(created.body).toMatchObject({ nombre: 'La Loma', ownerId: 'ana', miembrosIds: ['ana'] });
    expect(created.body.miembros.ana.rol).toBe('owner');
    const list = await ana.get('/api/campos').expect(200);
    expect(list.body.map((c) => c.id)).toEqual([created.body.id]);
  });

  it('solo el owner cambia roles o quita miembros, y nunca al owner', async () => {
    const { app, db } = makeApp();
    addCampo(db, 'c1', [['ana', 'owner'], ['beto', 'editor']]);
    const ana = await loginAs(app, db, 'ana');
    const beto = await loginAs(app, db, 'beto');
    await beto.patch('/api/campos/c1/miembros/ana').set(H).send({ rol: 'viewer' }).expect(403);
    await ana.patch('/api/campos/c1/miembros/ana').set(H).send({ rol: 'viewer' }).expect(400);
    await ana.patch('/api/campos/c1/miembros/beto').set(H).send({ rol: 'viewer' }).expect(200);
    expect(getDoc(db, 'campos', 'c1').miembros.beto.rol).toBe('viewer');
    await ana.delete('/api/campos/c1/miembros/beto').set(H).expect(200);
    expect(getDoc(db, 'campos', 'c1').miembrosIds).toEqual(['ana']);
    await ana.delete('/api/campos/c1/miembros/ana').set(H).expect(400);
  });
});

describe('invitaciones', () => {
  it('flujo completo: invitar, ver, aceptar y quedar aprobado', async () => {
    const { app, db } = makeApp();
    addCampo(db, 'c1', [['ana', 'owner']]);
    const ana = await loginAs(app, db, 'ana');
    const nico = await loginAs(app, db, 'nico', 'Nico@Example.com');
    putDoc(db, 'users', 'nico', { isApproved: false });

    const inv = await ana.post('/api/campos/c1/invitaciones').set(H).send({ email: 'nico@example.com', rol: 'viewer' }).expect(201);
    expect(inv.body).toMatchObject({ campoNombre: 'Campo c1', emailLower: 'nico@example.com', status: 'pending', invitedBy: 'ana' });

    const mine = await nico.get('/api/invitaciones').expect(200);
    expect(mine.body.map((i) => i.id)).toEqual([inv.body.id]);
    expect((await ana.get('/api/invitaciones')).body).toEqual([]);

    await ana.post(`/api/invitaciones/${inv.body.id}/accept`).set(H).expect(403);
    const accepted = await nico.post(`/api/invitaciones/${inv.body.id}/accept`).set(H).expect(200);
    expect(accepted.body.campoId).toBe('c1');
    expect(getDoc(db, 'campos', 'c1').miembros.nico).toMatchObject({ rol: 'viewer', email: 'Nico@Example.com' });
    expect((await nico.get('/api/auth/me')).body.isApproved).toBe(true);
    await nico.post(`/api/invitaciones/${inv.body.id}/accept`).set(H).expect(409);
  });

  it('rechazar marca la invitación como declined', async () => {
    const { app, db } = makeApp();
    addCampo(db, 'c1', [['ana', 'owner']]);
    const ana = await loginAs(app, db, 'ana');
    const nico = await loginAs(app, db, 'nico');
    const inv = await ana.post('/api/campos/c1/invitaciones').set(H).send({ email: 'nico@example.com' }).expect(201);
    await nico.post(`/api/invitaciones/${inv.body.id}/reject`).set(H).expect(200);
    expect(getDoc(db, 'campoInvitaciones', inv.body.id).status).toBe('declined');
    expect(getDoc(db, 'campos', 'c1').miembrosIds).toEqual(['ana']);
  });

  it('un viewer no puede invitar', async () => {
    const { app, db } = makeApp();
    addCampo(db, 'c1', [['ana', 'owner'], ['vero', 'viewer']]);
    const vero = await loginAs(app, db, 'vero');
    await vero.post('/api/campos/c1/invitaciones').set(H).send({ email: 'x@example.com' }).expect(403);
  });
});
