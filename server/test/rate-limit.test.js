import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { addAccount, makeApp } from './helpers.js';
import { hashPassword } from '../src/passwords.js';

const H = { 'X-Requested-With': 'campo' };
const desde = (ip) => ({ ...H, 'X-Forwarded-For': ip });

async function appConCuenta() {
  const ctx = makeApp();
  addAccount(ctx.db, { uid: 'u1', email: 'ana@example.com', hash: await hashPassword('clave123') });
  return ctx;
}

const login = (app, ip, email, password) => request(app).post('/api/auth/login').set(desde(ip)).send({ email, password });

describe('límite de intentos de login', () => {
  it('corta a los 8 intentos fallidos de la misma IP contra la misma cuenta, con Retry-After', async () => {
    const { app } = await appConCuenta();
    for (let i = 0; i < 8; i++) await login(app, '1.1.1.1', 'ana@example.com', 'mala').expect(401);
    const res = await login(app, '1.1.1.1', 'ana@example.com', 'clave123').expect(429);
    expect(res.body.code).toBe('auth/too-many-requests');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('desde otra IP el dueño de la cuenta entra igual', async () => {
    const { app } = await appConCuenta();
    for (let i = 0; i < 9; i++) await login(app, '1.1.1.1', 'ana@example.com', 'mala');
    await login(app, '2.2.2.2', 'ana@example.com', 'clave123').expect(200);
  });

  it('un login correcto reinicia el contador de esa IP y cuenta', async () => {
    const { app } = await appConCuenta();
    for (let i = 0; i < 7; i++) await login(app, '1.1.1.1', 'ana@example.com', 'mala').expect(401);
    await login(app, '1.1.1.1', 'ana@example.com', 'clave123').expect(200);
    for (let i = 0; i < 8; i++) await login(app, '1.1.1.1', 'ana@example.com', 'mala').expect(401);
  });

  it('una IP no puede probar muchas cuentas distintas: corta a los 30 intentos', async () => {
    const { app } = await appConCuenta();
    for (let i = 0; i < 30; i++) await login(app, '3.3.3.3', `alguien${i}@example.com`, 'x').expect(401);
    await login(app, '3.3.3.3', 'otro@example.com', 'x').expect(429);
  });

  it('no distingue mayúsculas en el email', async () => {
    const { app } = await appConCuenta();
    for (let i = 0; i < 8; i++) await login(app, '1.1.1.1', i % 2 ? 'ANA@example.com' : 'ana@example.com', 'mala').expect(401);
    await login(app, '1.1.1.1', 'Ana@Example.com', 'clave123').expect(429);
  });
});

describe('límite en registro y reseteo', () => {
  it('signup: 10 por hora por IP', async () => {
    const { app } = makeApp();
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/signup').set(desde('4.4.4.4')).send({ email: `n${i}@example.com`, password: 'clave123' }).expect(201);
    }
    await request(app).post('/api/auth/signup').set(desde('4.4.4.4')).send({ email: 'n11@example.com', password: 'clave123' }).expect(429);
    await request(app).post('/api/auth/signup').set(desde('5.5.5.5')).send({ email: 'n12@example.com', password: 'clave123' }).expect(201);
  });

  it('reset: 3 por hora por email, exista o no la cuenta (no revela quién está registrado)', async () => {
    const { app } = await appConCuenta();
    for (const email of ['ana@example.com', 'fantasma@example.com']) {
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/reset').set(desde(`6.6.${email.length}.${i}`)).send({ email }).expect(200);
      }
      await request(app).post('/api/auth/reset').set(desde('6.6.9.9')).send({ email }).expect(429);
    }
  });

  it('reset: 5 por hora por IP', async () => {
    const { app } = makeApp();
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/reset').set(desde('7.7.7.7')).send({ email: `x${i}@example.com` }).expect(200);
    await request(app).post('/api/auth/reset').set(desde('7.7.7.7')).send({ email: 'x9@example.com' }).expect(429);
  });
});
