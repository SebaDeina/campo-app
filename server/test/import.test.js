import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db.js';
import { importBackup, verifyImport } from '../scripts/import-firestore.js';

const DOCS = 'projects/p/databases/(default)/documents';

function sampleBackup() {
  return {
    firestore: {
      ovejas: [
        {
          name: `${DOCS}/ovejas/o1`,
          createTime: '2025-11-10T10:00:00.123456Z',
          updateTime: '2025-11-11T10:00:00Z',
          fields: {
            campoId: { stringValue: 'c1' },
            numeroCaravana: { stringValue: '101' },
            fechaNacimiento: { timestampValue: '2024-03-01T03:00:00Z' },
            peso: { arrayValue: { values: [{ mapValue: { fields: { kg: { doubleValue: 40.5 } } } }] } },
            reproductivo: { mapValue: { fields: { gestante: { booleanValue: true } } } },
          },
        },
      ],
      lluvias: [
        { name: `${DOCS}/lluvias/l1`, createTime: '2025-11-10T10:00:00Z', updateTime: '2025-11-10T10:00:00Z', fields: { campoId: { stringValue: 'c1' }, milimetros: { integerValue: '12' } } },
        { name: `${DOCS}/lluvias/l2`, createTime: '2025-11-10T10:00:00Z', updateTime: '2025-11-10T10:00:00Z', fields: { campoId: { stringValue: 'c1' }, milimetros: { doubleValue: 3.5 } } },
      ],
    },
    authUsers: [
      { localId: 'u1', email: 'Ana@Example.com', emailVerified: true, passwordHash: 'aGFzaA==', salt: 'c2FsdA==', displayName: 'Ana', createdAt: '1762639836776', lastSignedInAt: '1762700000000' },
      { localId: 'u2', email: 'bob@example.com', emailVerified: true, createdAt: '1762663930309', providerUserInfo: [{ providerId: 'google.com', rawId: '1234567890', email: 'bob@example.com' }] },
    ],
  };
}

describe('importBackup', () => {
  it('importa documentos y cuentas y la verificación da OK', () => {
    const db = openDb(':memory:');
    const report = importBackup(db, sampleBackup());
    expect(report.collections).toEqual({ ovejas: 1, lluvias: 2 });
    expect(report.accounts).toBe(2);

    const oveja = db.prepare("SELECT data, raw, created_at FROM docs WHERE collection='ovejas' AND id='o1'").get();
    expect(JSON.parse(oveja.data)).toEqual({
      campoId: 'c1',
      numeroCaravana: '101',
      fechaNacimiento: { __t: 'ts', v: '2024-03-01T03:00:00Z' },
      peso: [{ kg: 40.5 }],
      reproductivo: { gestante: true },
    });
    expect(JSON.parse(oveja.raw).name).toBe(`${DOCS}/ovejas/o1`);
    expect(oveja.created_at).toBe('2025-11-10T10:00:00.123456Z');

    const ana = db.prepare("SELECT * FROM auth_accounts WHERE uid='u1'").get();
    expect(ana).toMatchObject({ email: 'Ana@Example.com', password_algo: 'firebase-scrypt', password_hash: 'aGFzaA==', password_salt: 'c2FsdA==', google_sub: null, email_verified: 1 });
    expect(ana.created_at).toBe(new Date(1762639836776).toISOString());
    const bob = db.prepare("SELECT * FROM auth_accounts WHERE uid='u2'").get();
    expect(bob).toMatchObject({ password_algo: null, google_sub: '1234567890' });

    expect(verifyImport(db, sampleBackup(), { exact: true })).toEqual({ ok: true, problems: [] });
  });

  it('es idempotente', () => {
    const db = openDb(':memory:');
    importBackup(db, sampleBackup());
    importBackup(db, sampleBackup());
    expect(db.prepare('SELECT count(*) AS n FROM docs').get().n).toBe(3);
    expect(db.prepare('SELECT count(*) AS n FROM auth_accounts').get().n).toBe(2);
  });

  it('con replace borra lo que no está en el backup', () => {
    const db = openDb(':memory:');
    db.prepare("INSERT INTO docs (collection, id, data) VALUES ('tareas', 'vieja', '{}')").run();
    importBackup(db, sampleBackup(), { replace: true });
    expect(db.prepare("SELECT count(*) AS n FROM docs WHERE id='vieja'").get().n).toBe(0);
  });

  it('sin replace, verificación exacta detecta documentos de más', () => {
    const db = openDb(':memory:');
    db.prepare("INSERT INTO docs (collection, id, data) VALUES ('tareas', 'extra', '{}')").run();
    importBackup(db, sampleBackup());
    const result = verifyImport(db, sampleBackup(), { exact: true });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/tareas\/extra/);
  });

  it('la verificación detecta un documento alterado o faltante', () => {
    const db = openDb(':memory:');
    importBackup(db, sampleBackup());
    db.prepare("UPDATE docs SET data = json_set(data, '$.milimetros', 99) WHERE id = 'l1'").run();
    db.prepare("DELETE FROM docs WHERE id = 'l2'").run();
    const result = verifyImport(db, sampleBackup());
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/lluvias\/l1.*distinto/),
      expect.stringMatching(/lluvias\/l2.*falta/),
    ]));
  });

  it('dryRun verifica todo pero no guarda nada', () => {
    const db = openDb(':memory:');
    const report = importBackup(db, sampleBackup(), { dryRun: true });
    expect(report.collections).toEqual({ ovejas: 1, lluvias: 2 });
    expect(db.prepare('SELECT count(*) AS n FROM docs').get().n).toBe(0);
  });

  it('hace rollback completo si un documento no se puede decodificar', () => {
    const db = openDb(':memory:');
    const backup = sampleBackup();
    backup.firestore.lluvias[1].fields.raro = { fooValue: 1 };
    expect(() => importBackup(db, backup)).toThrow(/desconocido/);
    expect(db.prepare('SELECT count(*) AS n FROM docs').get().n).toBe(0);
    expect(db.prepare('SELECT count(*) AS n FROM auth_accounts').get().n).toBe(0);
  });
});
