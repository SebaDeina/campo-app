import request from 'supertest';
import { openDb } from '../src/db.js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { putDoc } from '../src/store.js';

// Vector público de github.com/firebase/scrypt: la contraseña es "user1password".
export const FIREBASE_VECTOR = {
  cfg: {
    FIREBASE_SCRYPT_SIGNER_KEY: 'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==',
    FIREBASE_SCRYPT_SALT_SEPARATOR: 'Bw==',
    FIREBASE_SCRYPT_ROUNDS: '8',
    FIREBASE_SCRYPT_MEM_COST: '14',
  },
  salt: '42xEC+ixf3L2lw==',
  hash: 'lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==',
  password: 'user1password',
};

export function makeApp({ env = {}, fetchImpl } = {}) {
  const db = openDb(':memory:');
  const config = loadConfig({
    PUBLIC_URL: 'http://campo.test',
    ADMIN_EMAILS: 'admin@example.com',
    GOOGLE_CLIENT_ID: 'cid',
    GOOGLE_CLIENT_SECRET: 'csecret',
    ...FIREBASE_VECTOR.cfg,
    ...env,
  });
  const mails = [];
  const mailer = {
    sendWelcome: async (email, name) => { mails.push({ type: 'welcome', email, name }); },
    sendPasswordReset: async (email, link) => { mails.push({ type: 'reset', email, link }); },
  };
  const app = createApp({ db, config, mailer, fetchImpl });
  return { app, db, config, mails };
}

export function addAccount(db, { uid, email, algo = 'scrypt', hash = null, salt = null, googleSub = null }) {
  db.prepare(`
    INSERT INTO auth_accounts (uid, email, password_algo, password_hash, password_salt, google_sub, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uid, email, hash ? algo : null, hash, salt, googleSub, new Date().toISOString());
}

export function addCampo(db, id, members) {
  putDoc(db, 'campos', id, {
    nombre: `Campo ${id}`,
    ownerId: members[0][0],
    miembrosIds: members.map(([uid]) => uid),
    miembros: Object.fromEntries(members.map(([uid, rol]) => [uid, { uid, rol, email: `${uid}@example.com` }])),
  });
}

// Agente con sesión iniciada, que manda el header anti-CSRF.
export async function loginAs(app, db, uid, email = `${uid}@example.com`) {
  const { hashPassword } = await import('../src/passwords.js');
  if (!db.prepare('SELECT 1 FROM auth_accounts WHERE uid = ?').get(uid)) {
    addAccount(db, { uid, email, hash: await hashPassword('clave123') });
  }
  const agent = request.agent(app);
  await agent.post('/api/auth/login').set('X-Requested-With', 'campo').send({ email, password: 'clave123' }).expect(200);
  return agent;
}
