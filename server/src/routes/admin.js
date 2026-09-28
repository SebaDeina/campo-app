import { Router } from 'express';
import { HttpError, camposOf, getAccount, requireAuth, userStatus } from '../access.js';
import { getDoc, putDoc } from '../store.js';
import { nowTimestamp } from '../codec.js';

export function adminRoutes({ db, config }) {
  const router = Router();

  router.use((req, res, next) => {
    const account = requireAuth(req);
    if (!userStatus(db, config, account).isAdmin) throw new HttpError(403, 'Solo para administradores', 'auth/forbidden');
    next();
  });

  router.get('/users', (req, res) => {
    const accounts = db.prepare('SELECT * FROM auth_accounts ORDER BY created_at DESC').all();
    res.json(accounts.map((account) => {
      const status = userStatus(db, config, account);
      return {
        uid: account.uid,
        email: account.email,
        displayName: account.display_name || status.profile?.displayName || '',
        createdAt: account.created_at,
        lastLoginAt: account.last_login_at,
        isApproved: status.isApproved,
        approvedManually: status.profile?.isApproved === true,
        isAdmin: status.isAdmin,
        campos: camposOf(db, account.uid).map((c) => c.data.nombre),
        providers: [account.password_hash && 'password', account.google_sub && 'google'].filter(Boolean),
      };
    }));
  });

  router.post('/users/:uid/approval', (req, res) => {
    const account = getAccount(db, req.params.uid);
    if (!account) throw new HttpError(404, 'Usuario no encontrado');
    if (typeof req.body?.isApproved !== 'boolean') throw new HttpError(400, 'isApproved debe ser true o false');
    const profile = getDoc(db, 'users', account.uid) || {
      email: account.email, displayName: account.display_name || '', createdAt: nowTimestamp(), role: 'user',
    };
    putDoc(db, 'users', account.uid, { ...profile, isApproved: req.body.isApproved });
    res.json({ ok: true });
  });

  return router;
}
