import { describe, it, expect } from 'vitest';
import { verifyFirebaseScrypt, hashPassword, verifyPassword } from '../src/passwords.js';

// Vector público del README de github.com/firebase/scrypt
const cfg = {
  signerKey: 'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==',
  saltSeparator: 'Bw==',
  rounds: 8,
  memCost: 14,
};
const salt = '42xEC+ixf3L2lw==';
const hash = 'lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==';

describe('verifyFirebaseScrypt', () => {
  it('acepta la contraseña correcta del vector de Firebase', async () => {
    expect(await verifyFirebaseScrypt({ password: 'user1password', salt, hash, cfg })).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    expect(await verifyFirebaseScrypt({ password: 'user1passwordX', salt, hash, cfg })).toBe(false);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashea con scrypt propio y verifica', async () => {
    const stored = await hashPassword('secreta123');
    expect(stored).toMatch(/^scrypt\$15\$8\$1\$/);
    const account = { password_algo: 'scrypt', password_hash: stored };
    expect(await verifyPassword(account, 'secreta123', cfg)).toEqual({ ok: true, needsRehash: false });
    expect(await verifyPassword(account, 'otra', cfg)).toEqual({ ok: false, needsRehash: false });
  });

  it('pide rehash cuando la cuenta viene de Firebase', async () => {
    const account = { password_algo: 'firebase-scrypt', password_hash: hash, password_salt: salt };
    expect(await verifyPassword(account, 'user1password', cfg)).toEqual({ ok: true, needsRehash: true });
  });

  it('rechaza cuentas sin contraseña (solo Google)', async () => {
    expect(await verifyPassword({ password_algo: null }, 'x', cfg)).toEqual({ ok: false, needsRehash: false });
  });
});
