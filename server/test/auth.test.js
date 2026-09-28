import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { FIREBASE_VECTOR, addAccount, addCampo, loginAs, makeApp } from './helpers.js';
import { putDoc } from '../src/store.js';

const H = { 'X-Requested-With': 'campo' };

describe('login con contraseña', () => {
  it('acepta un hash migrado de Firebase y lo re-hashea', async () => {
    const { app, db } = makeApp();
    addAccount(db, { uid: 'u1', email: 'Ana@Example.com', algo: 'firebase-scrypt', hash: FIREBASE_VECTOR.hash, salt: FIREBASE_VECTOR.salt });

    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').set(H).send({ email: 'ana@example.com', password: FIREBASE_VECTOR.password });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ uid: 'u1', email: 'Ana@Example.com' });
    expect(res.headers['set-cookie'][0]).toMatch(/campo_sid=.*HttpOnly/i);

    const row = db.prepare("SELECT password_algo, password_salt FROM auth_accounts WHERE uid = 'u1'").get();
    expect(row).toEqual({ password_algo: 'scrypt', password_salt: null });

    // Sigue entrando con la misma contraseña después del rehash.
    await request(app).post('/api/auth/login').set(H).send({ email: 'ana@example.com', password: FIREBASE_VECTOR.password }).expect(200);
    await agent.get('/api/auth/me').expect(200);
  });

  it('rechaza contraseña incorrecta y usuario inexistente con el mismo error', async () => {
    const { app, db } = makeApp();
    addAccount(db, { uid: 'u1', email: 'a@example.com', algo: 'firebase-scrypt', hash: FIREBASE_VECTOR.hash, salt: FIREBASE_VECTOR.salt });
    const wrong = await request(app).post('/api/auth/login').set(H).send({ email: 'a@example.com', password: 'nop' });
    const missing = await request(app).post('/api/auth/login').set(H).send({ email: 'x@example.com', password: 'nop' });
    expect(wrong.status).toBe(401);
    expect(missing.body).toEqual(wrong.body);
    expect(wrong.body.code).toBe('auth/invalid-credential');
  });

  it('con URL pública https la cookie es Secure', async () => {
    const { app, db } = makeApp({ env: { PUBLIC_URL: 'https://campo.test' } });
    addAccount(db, { uid: 'u1', email: 'a@example.com', algo: 'firebase-scrypt', hash: FIREBASE_VECTOR.hash, salt: FIREBASE_VECTOR.salt });
    const res = await request(app).post('/api/auth/login').set(H).send({ email: 'a@example.com', password: FIREBASE_VECTOR.password });
    expect(res.headers['set-cookie'][0]).toMatch(/campo_sid=.*HttpOnly.*Secure.*SameSite=Lax/i);
  });

  it('exige el header anti-CSRF en pedidos que modifican', async () => {
    const { app } = makeApp();
    await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' }).expect(403);
  });

  it('logout invalida la sesión', async () => {
    const { app, db } = makeApp();
    const agent = await loginAs(app, db, 'u1');
    await agent.post('/api/auth/logout').set(H).expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('signup y aprobación', () => {
  it('crea la cuenta pendiente de aprobación y manda bienvenida', async () => {
    const { app, db, mails } = makeApp();
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/signup').set(H).send({ email: 'nuevo@example.com', password: 'clave123', displayName: 'Nuevo' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'nuevo@example.com', displayName: 'Nuevo', isApproved: false });
    expect(res.body.uid).toMatch(/^[A-Za-z0-9]{28}$/);
    const profile = JSON.parse(db.prepare("SELECT data FROM docs WHERE collection = 'users' AND id = ?").get(res.body.uid).data);
    expect(profile).toMatchObject({ email: 'nuevo@example.com', isApproved: false, role: 'user' });
    await new Promise((r) => setImmediate(r));
    expect(mails).toEqual([{ type: 'welcome', email: 'nuevo@example.com', name: 'Nuevo' }]);
  });

  it('rechaza emails repetidos y contraseñas cortas con códigos de Firebase', async () => {
    const { app, db } = makeApp();
    addAccount(db, { uid: 'u1', email: 'ya@example.com' });
    const dup = await request(app).post('/api/auth/signup').set(H).send({ email: 'YA@example.com', password: 'clave123' });
    expect(dup.body.code).toBe('auth/email-already-in-use');
    const weak = await request(app).post('/api/auth/signup').set(H).send({ email: 'otro@example.com', password: '123' });
    expect(weak.body.code).toBe('auth/weak-password');
  });

  it('un miembro de un campo queda aprobado aunque isApproved sea false', async () => {
    const { app, db } = makeApp();
    const agent = await loginAs(app, db, 'owner1');
    putDoc(db, 'users', 'owner1', { email: 'owner1@example.com', isApproved: false });
    expect((await agent.get('/api/auth/me')).body.isApproved).toBe(false);
    addCampo(db, 'c1', [['owner1', 'owner']]);
    expect((await agent.get('/api/auth/me')).body.isApproved).toBe(true);
  });

  it('solo un admin lista y aprueba usuarios', async () => {
    const { app, db } = makeApp();
    const user = await loginAs(app, db, 'u1');
    putDoc(db, 'users', 'u1', { email: 'u1@example.com', isApproved: false });
    await user.get('/api/admin/users').expect(403);

    const admin = await loginAs(app, db, 'adm', 'admin@example.com');
    const list = await admin.get('/api/admin/users').expect(200);
    expect(list.body.find((u) => u.uid === 'u1')).toMatchObject({ isApproved: false, providers: ['password'] });
    await admin.post('/api/admin/users/u1/approval').set(H).send({ isApproved: true }).expect(200);
    expect((await user.get('/api/auth/me')).body.isApproved).toBe(true);
  });
});

describe('Google OAuth', () => {
  function googleFetch(info) {
    return async (url) => {
      if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'at' });
      if (url.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) return Response.json(info);
      throw new Error(`fetch inesperado: ${url}`);
    };
  }

  async function runFlow(app) {
    const agent = request.agent(app);
    const start = await agent.get('/api/auth/google').expect(302);
    const url = new URL(start.headers.location);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('redirect_uri')).toBe('http://campo.test/api/auth/google/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const cb = await agent.get(`/api/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`);
    return { agent, cb };
  }

  it('vincula una cuenta existente por google_sub (usuario migrado)', async () => {
    const { app, db } = makeApp({ fetchImpl: googleFetch({ sub: '111', email: 'owner@gmail.com', email_verified: true, name: 'Owner' }) });
    addAccount(db, { uid: 'fbUid', email: 'owner@gmail.com', googleSub: '111' });
    const { agent, cb } = await runFlow(app);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/app');
    expect((await agent.get('/api/auth/me')).body.uid).toBe('fbUid');
  });

  it('vincula por email verificado si la cuenta no tenía Google', async () => {
    const { app, db } = makeApp({ fetchImpl: googleFetch({ sub: '222', email: 'Ana@example.com', email_verified: true }) });
    addAccount(db, { uid: 'u1', email: 'ana@example.com' });
    const { agent } = await runFlow(app);
    expect((await agent.get('/api/auth/me')).body.uid).toBe('u1');
    expect(db.prepare("SELECT google_sub FROM auth_accounts WHERE uid = 'u1'").get().google_sub).toBe('222');
  });

  it('crea cuenta nueva pendiente si no existe', async () => {
    const { app } = makeApp({ fetchImpl: googleFetch({ sub: '333', email: 'nuevo@gmail.com', email_verified: true, name: 'N' }) });
    const { agent } = await runFlow(app);
    expect((await agent.get('/api/auth/me')).body).toMatchObject({ email: 'nuevo@gmail.com', isApproved: false });
  });

  it('rechaza state inválido y emails no verificados', async () => {
    const { app } = makeApp({ fetchImpl: googleFetch({ sub: '4', email: 'x@gmail.com', email_verified: false }) });
    const bad = await request(app).get('/api/auth/google/callback?code=abc&state=otro');
    expect(bad.headers.location).toBe('/login?error=google');
    const { cb } = await runFlow(app);
    expect(cb.headers.location).toBe('/login?error=google');
  });
});

describe('recuperar contraseña', () => {
  it('manda el link, cambia la clave y cierra las sesiones abiertas', async () => {
    const { app, db, mails } = makeApp();
    const agent = await loginAs(app, db, 'u1');
    await request(app).post('/api/auth/reset').set(H).send({ email: 'u1@example.com' }).expect(200);
    const token = new URL(mails.at(-1).link).searchParams.get('token');
    expect(mails.at(-1).link).toMatch(/^http:\/\/campo\.test\/reset-password\?token=/);

    await request(app).post('/api/auth/reset/confirm').set(H).send({ token, password: 'nueva123' }).expect(200);
    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').set(H).send({ email: 'u1@example.com', password: 'nueva123' }).expect(200);
    await request(app).post('/api/auth/reset/confirm').set(H).send({ token, password: 'otra123' }).expect(400);
  });

  it('responde igual si el email no existe', async () => {
    const { app, mails } = makeApp();
    await request(app).post('/api/auth/reset').set(H).send({ email: 'nadie@example.com' }).expect(200);
    expect(mails).toEqual([]);
  });
});
