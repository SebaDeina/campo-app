import { getDoc, listDocs } from './store.js';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const IS_MEMBER = "AND EXISTS (SELECT 1 FROM json_each(data, '$.miembrosIds') WHERE value = ?)";

export function camposOf(db, uid) {
  return listDocs(db, 'campos', IS_MEMBER, uid);
}

// Rol del usuario en el campo, o null si no es miembro.
export function campoRole(db, campoId, uid) {
  const campo = typeof campoId === 'string' ? getDoc(db, 'campos', campoId) : null;
  if (!campo || !(campo.miembrosIds || []).includes(uid)) return null;
  return campo.miembros?.[uid]?.rol || 'editor';
}

export const canWrite = (rol) => rol === 'owner' || rol === 'editor';

export function getAccount(db, uid) {
  return db.prepare('SELECT * FROM auth_accounts WHERE uid = ?').get(uid) || null;
}

export function isAdmin(config, account, profile) {
  return config.adminEmails.has(account.email.toLowerCase()) || profile?.role === 'admin';
}

// Aprobado = marcado a mano, admin, o ya forma parte de algún campo. Lo último
// evita que usuarios previos al sistema de aprobación queden bloqueados.
export function userStatus(db, config, account) {
  const profile = getDoc(db, 'users', account.uid);
  const admin = isAdmin(config, account, profile);
  const approved = admin || profile?.isApproved === true || camposOf(db, account.uid).length > 0;
  return { profile, isAdmin: admin, isApproved: approved };
}

export function publicUser(db, config, account) {
  const { profile, isAdmin: admin, isApproved } = userStatus(db, config, account);
  return {
    uid: account.uid,
    email: account.email,
    displayName: account.display_name || profile?.displayName || '',
    isApproved,
    isAdmin: admin,
    hasPassword: Boolean(account.password_hash),
    hasGoogle: Boolean(account.google_sub),
  };
}

export function requireAuth(req) {
  if (!req.account) throw new HttpError(401, 'Tenés que iniciar sesión', 'auth/unauthenticated');
  return req.account;
}

export function requireApproved(db, config, req) {
  const account = requireAuth(req);
  if (!userStatus(db, config, account).isApproved) {
    throw new HttpError(403, 'Tu cuenta todavía no fue aprobada', 'auth/not-approved');
  }
  return account;
}
