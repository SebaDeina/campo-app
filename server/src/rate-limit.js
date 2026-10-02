import { HttpError } from './access.js';

// Limitador de ventana fija, en memoria. Alcanza para un solo proceso (es nuestro caso);
// si la app pasa a varias instancias, esto tiene que ir a la base.
export function createLimiter({ windowMs, max }) {
  const hits = new Map();
  let nextSweep = 0;

  function sweep(now) {
    if (now < nextSweep) return;
    nextSweep = now + windowMs;
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }

  return {
    // Cuenta un intento y corta con 429 cuando se pasa del máximo de la ventana.
    hit(res, key) {
      const now = Date.now();
      sweep(now);
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > max) {
        const seconds = Math.ceil((entry.resetAt - now) / 1000);
        res.set('Retry-After', String(seconds));
        throw new HttpError(429, `Demasiados intentos. Probá de nuevo en ${Math.ceil(seconds / 60)} min.`, 'auth/too-many-requests');
      }
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

const MIN = 60_000;
const HORA = 60 * MIN;

// Un juego de limitadores por app (así los tests no se pisan entre sí).
export function createAuthLimiters() {
  return {
    loginIp: createLimiter({ windowMs: 15 * MIN, max: 30 }),
    loginCuenta: createLimiter({ windowMs: 15 * MIN, max: 8 }),
    signupIp: createLimiter({ windowMs: HORA, max: 10 }),
    resetIp: createLimiter({ windowMs: HORA, max: 5 }),
    resetEmail: createLimiter({ windowMs: HORA, max: 3 }),
    confirmIp: createLimiter({ windowMs: HORA, max: 20 }),
    googleIp: createLimiter({ windowMs: 15 * MIN, max: 60 }),
  };
}
