import { Router } from 'express';
import { createHash } from 'node:crypto';
import { HttpError, getAccount, publicUser, requireAuth } from '../access.js';
import { hashPassword, verifyPassword } from '../passwords.js';
import {
  SESSION_COOKIE, createSession, deleteSession, deleteUserSessions, randomToken, sha256,
} from '../sessions.js';
import { getDoc, putDoc } from '../store.js';
import { newUid } from '../ids.js';
import { nowTimestamp } from '../codec.js';

const OAUTH_COOKIE = 'campo_oauth';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim() : '';
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres', 'auth/weak-password');
  }
}

function findByEmail(db, email) {
  return db.prepare('SELECT * FROM auth_accounts WHERE email = ? COLLATE NOCASE').get(email) || null;
}

export function authRoutes({ db, config, mailer, fetchImpl = fetch }) {
  const router = Router();
  const cookieBase = { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/' };

  function startSession(res, uid) {
    const { token, expires } = createSession(db, uid, config.sessionDays);
    db.prepare('UPDATE auth_accounts SET last_login_at = ? WHERE uid = ?').run(new Date().toISOString(), uid);
    res.cookie(SESSION_COOKIE, token, { ...cookieBase, expires: new Date(expires) });
  }

  function createAccount({ email, displayName, passwordHash = null, googleSub = null, emailVerified = false }) {
    const uid = newUid();
    db.prepare(`
      INSERT INTO auth_accounts (uid, email, password_algo, password_hash, google_sub, display_name, email_verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uid, email, passwordHash ? 'scrypt' : null, passwordHash, googleSub, displayName || null,
      emailVerified ? 1 : 0, new Date().toISOString());
    putDoc(db, 'users', uid, {
      email, displayName: displayName || '', isApproved: false, createdAt: nowTimestamp(), role: 'user',
    });
    mailer.sendWelcome(email, displayName).catch((err) => console.error('[mail] bienvenida:', err.message));
    return getAccount(db, uid);
  }

  router.post('/signup', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const displayName = (req.body?.displayName || '').trim();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email inválido', 'auth/invalid-email');
    validatePassword(req.body?.password);
    if (findByEmail(db, email)) throw new HttpError(409, 'El email ya está registrado', 'auth/email-already-in-use');

    const account = createAccount({ email, displayName, passwordHash: await hashPassword(req.body.password) });
    startSession(res, account.uid);
    res.status(201).json(publicUser(db, config, account));
  });

  router.post('/login', async (req, res) => {
    const account = findByEmail(db, normalizeEmail(req.body?.email));
    const { ok, needsRehash } = account
      ? await verifyPassword(account, req.body?.password, config.firebaseScrypt)
      : { ok: false };
    if (!ok) throw new HttpError(401, 'Email o contraseña incorrectos', 'auth/invalid-credential');
    if (account.disabled) throw new HttpError(403, 'La cuenta está deshabilitada', 'auth/user-disabled');

    if (needsRehash) {
      db.prepare("UPDATE auth_accounts SET password_algo = 'scrypt', password_hash = ?, password_salt = NULL WHERE uid = ?")
        .run(await hashPassword(req.body.password), account.uid);
    }
    startSession(res, account.uid);
    res.json(publicUser(db, config, account));
  });

  router.post('/logout', (req, res) => {
    deleteSession(db, req.cookies[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, cookieBase);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json(publicUser(db, config, requireAuth(req)));
  });

  router.patch('/me', (req, res) => {
    const account = requireAuth(req);
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : null;
    if (displayName === null) throw new HttpError(400, 'Falta displayName');
    db.prepare('UPDATE auth_accounts SET display_name = ? WHERE uid = ?').run(displayName, account.uid);
    const profile = getDoc(db, 'users', account.uid);
    if (profile) putDoc(db, 'users', account.uid, { ...profile, displayName });
    res.json(publicUser(db, config, getAccount(db, account.uid)));
  });

  // --- Google OAuth (authorization code + PKCE) ---
  const redirectUri = `${config.publicUrl}/api/auth/google/callback`;

  router.get('/google', (req, res) => {
    if (!config.google) throw new HttpError(503, 'El login con Google no está configurado');
    const state = randomToken(16);
    const verifier = randomToken(32);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res.cookie(OAUTH_COOKIE, `${state}.${verifier}`, { ...cookieBase, maxAge: 10 * 60_000 });
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  router.get('/google/callback', async (req, res) => {
    const fail = (reason) => {
      console.warn('[google] login falló:', reason);
      res.clearCookie(OAUTH_COOKIE, cookieBase);
      res.redirect('/login?error=google');
    };
    if (!config.google) return fail('no configurado');
    const [state, verifier] = (req.cookies[OAUTH_COOKIE] || '').split('.');
    if (!state || state !== req.query.state || !req.query.code) return fail('state inválido');

    const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) return fail(`token ${tokenRes.status}`);
    const { access_token: accessToken } = await tokenRes.json();

    const infoRes = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return fail(`userinfo ${infoRes.status}`);
    const info = await infoRes.json();
    if (!info.sub || !info.email || info.email_verified !== true) return fail('email no verificado');

    let account = db.prepare('SELECT * FROM auth_accounts WHERE google_sub = ?').get(info.sub)
      || findByEmail(db, info.email);
    if (account && !account.google_sub) {
      db.prepare('UPDATE auth_accounts SET google_sub = ?, email_verified = 1 WHERE uid = ?').run(info.sub, account.uid);
    }
    if (!account) {
      account = createAccount({ email: info.email, displayName: info.name, googleSub: info.sub, emailVerified: true });
    }
    if (account.disabled) return fail('cuenta deshabilitada');

    res.clearCookie(OAUTH_COOKIE, cookieBase);
    startSession(res, account.uid);
    res.redirect('/app');
  });

  // --- Recuperar contraseña ---
  router.post('/reset', async (req, res) => {
    const account = findByEmail(db, normalizeEmail(req.body?.email));
    if (account && !account.disabled) {
      const token = randomToken(32);
      const expires = new Date(Date.now() + 3600_000).toISOString();
      db.prepare('INSERT INTO password_resets (token_hash, uid, expires_at) VALUES (?, ?, ?)').run(sha256(token), account.uid, expires);
      const link = `${config.publicUrl}/reset-password?token=${token}`;
      await mailer.sendPasswordReset(account.email, link);
    }
    // Misma respuesta exista o no la cuenta, para no revelar qué emails están registrados.
    res.json({ ok: true });
  });

  router.post('/reset/confirm', async (req, res) => {
    validatePassword(req.body?.password);
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(String(req.body?.token || '')));
    if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
      throw new HttpError(400, 'El enlace venció o ya se usó. Pedí uno nuevo.', 'auth/invalid-action-code');
    }
    const hash = await hashPassword(req.body.password);
    db.prepare("UPDATE auth_accounts SET password_algo = 'scrypt', password_hash = ?, password_salt = NULL WHERE uid = ?").run(hash, row.uid);
    db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(new Date().toISOString(), row.token_hash);
    deleteUserSessions(db, row.uid);
    res.json({ ok: true });
  });

  return router;
}
