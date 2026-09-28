import { scrypt, randomBytes, createCipheriv, timingSafeEqual } from 'node:crypto';

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function safeEqual(a, b) {
  return a.length === b.length && timingSafeEqual(a, b);
}

// Variante de scrypt que usa Firebase Auth (github.com/firebase/scrypt):
// la clave derivada cifra el signer key con AES-256-CTR y eso es el hash.
export async function verifyFirebaseScrypt({ password, salt, hash, cfg }) {
  const N = 2 ** cfg.memCost;
  const saltBuf = Buffer.concat([Buffer.from(salt, 'base64'), Buffer.from(cfg.saltSeparator, 'base64')]);
  const key = await scryptAsync(Buffer.from(password, 'utf8'), saltBuf, 32, {
    N, r: cfg.rounds, p: 1, maxmem: 256 * N * cfg.rounds,
  });
  const cipher = createCipheriv('aes-256-ctr', key, Buffer.alloc(16, 0));
  const derived = Buffer.concat([cipher.update(Buffer.from(cfg.signerKey, 'base64')), cipher.final()]);
  return safeEqual(derived, Buffer.from(hash, 'base64'));
}

const LOG_N = 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { N: 2 ** LOG_N, r: R, p: P, maxmem: 256 * 2 ** LOG_N * R });
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyOwnScrypt(stored, password) {
  const [algo, logN, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const N = 2 ** Number(logN);
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N, r: Number(r), p: Number(p), maxmem: 256 * N * Number(r),
  });
  return safeEqual(key, expected);
}

// Devuelve { ok, needsRehash }. needsRehash = la cuenta todavía tiene el hash de Firebase.
export async function verifyPassword(account, password, firebaseCfg) {
  if (!password || !account?.password_hash) return { ok: false, needsRehash: false };
  if (account.password_algo === 'firebase-scrypt') {
    if (!firebaseCfg?.signerKey) throw new Error('Falta la configuración FIREBASE_SCRYPT_* en el servidor');
    const ok = await verifyFirebaseScrypt({
      password, salt: account.password_salt, hash: account.password_hash, cfg: firebaseCfg,
    });
    return { ok, needsRehash: ok };
  }
  if (account.password_algo === 'scrypt') {
    return { ok: await verifyOwnScrypt(account.password_hash, password), needsRehash: false };
  }
  return { ok: false, needsRehash: false };
}
