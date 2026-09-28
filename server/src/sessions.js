import { randomBytes, createHash } from 'node:crypto';

export const SESSION_COOKIE = 'campo_sid';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function createSession(db, uid, days) {
  const token = randomToken();
  const expires = new Date(Date.now() + days * 86400_000).toISOString();
  db.prepare('INSERT INTO sessions (id_hash, uid, expires_at) VALUES (?, ?, ?)').run(sha256(token), uid, expires);
  return { token, expires };
}

export function sessionUid(db, token) {
  if (!token) return null;
  const row = db.prepare('SELECT uid, expires_at FROM sessions WHERE id_hash = ?').get(sha256(token));
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
    return null;
  }
  return row.uid;
}

export function deleteSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
}

export function deleteUserSessions(db, uid) {
  db.prepare('DELETE FROM sessions WHERE uid = ?').run(uid);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
