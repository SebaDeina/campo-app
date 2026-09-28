import express from 'express';
import { join } from 'node:path';
import { HttpError, getAccount } from './access.js';
import { SESSION_COOKIE, parseCookies, sessionUid } from './sessions.js';
import { createMailer } from './mail.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { dataRoutes } from './routes/data.js';
import { camposRoutes } from './routes/campos.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createApp({ db, config, mailer = createMailer(config), fetchImpl = fetch }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '2mb' }));

  app.use((req, res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    const uid = sessionUid(db, req.cookies[SESSION_COOKIE]);
    const account = uid ? getAccount(db, uid) : null;
    req.account = account && !account.disabled ? account : null;
    next();
  });

  // CSRF: un header propio obliga al navegador a hacer preflight, y no hay CORS.
  app.use('/api', (req, res, next) => {
    if (!SAFE_METHODS.has(req.method) && req.get('x-requested-with') !== 'campo') {
      throw new HttpError(403, 'Pedido rechazado', 'csrf');
    }
    next();
  });

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });
  app.use('/api/auth', authRoutes({ db, config, mailer, fetchImpl }));
  app.use('/api/admin', adminRoutes({ db, config }));
  app.use('/api/db', dataRoutes({ db, config }));
  app.use('/api', camposRoutes({ db, config }));
  app.use('/api', () => {
    throw new HttpError(404, 'No encontrado');
  });

  if (config.staticDir) {
    app.use('/assets', express.static(join(config.staticDir, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(config.staticDir, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 ? 'Error interno del servidor' : err.message,
      code: err.code,
    });
  });

  return app;
}
