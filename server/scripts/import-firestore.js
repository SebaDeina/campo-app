// Importa un backup de Firebase (dump REST de Firestore + `firebase auth:export`)
// a la base SQLite y verifica documento por documento. Todo corre en una sola
// transacción: si algo no coincide, no queda nada a medias.
//
// Uso:
//   node scripts/import-firestore.js --backup ~/nimbo-backups/<ts> --db data/campo.sqlite [--replace] [--dry-run]
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { openDb, tx } from '../src/db.js';
import { decodeFields } from '../src/codec.js';

function docPath(name) {
  const path = name.split('/documents/')[1];
  const cut = path.lastIndexOf('/');
  return { collection: path.slice(0, cut), id: path.slice(cut + 1) };
}

function msToIso(ms) {
  return ms ? new Date(Number(ms)).toISOString() : null;
}

function accountRow(user) {
  if (!user.email) throw new Error(`La cuenta ${user.localId} no tiene email`);
  const google = (user.providerUserInfo || []).find((p) => p.providerId === 'google.com');
  return {
    uid: user.localId,
    email: user.email,
    password_algo: user.passwordHash ? 'firebase-scrypt' : null,
    password_hash: user.passwordHash || null,
    password_salt: user.passwordHash ? user.salt || '' : null,
    google_sub: google?.rawId || null,
    display_name: user.displayName || null,
    email_verified: user.emailVerified ? 1 : 0,
    disabled: user.disabled ? 1 : 0,
    created_at: msToIso(user.createdAt) || new Date().toISOString(),
    last_login_at: msToIso(user.lastSignedInAt),
    firebase_raw: JSON.stringify(user),
  };
}

class DryRunRollback extends Error {
  constructor(report) { super('dry run'); this.report = report; }
}

// dryRun: hace todo (incluida la verificación) y después rollback.
export function importBackup(db, { firestore, authUsers }, { replace = false, dryRun = false } = {}) {
  try {
    return importInTx(db, { firestore, authUsers }, { replace, dryRun });
  } catch (err) {
    if (err instanceof DryRunRollback) return err.report;
    throw err;
  }
}

function importInTx(db, { firestore, authUsers }, { replace, dryRun }) {
  return tx(db, () => {
    if (replace) {
      db.exec('DELETE FROM docs; DELETE FROM auth_accounts; DELETE FROM sessions; DELETE FROM password_resets;');
    }

    const upsertDoc = db.prepare(`
      INSERT INTO docs (collection, id, data, raw, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (collection, id) DO UPDATE SET
        data = excluded.data, raw = excluded.raw,
        created_at = excluded.created_at, updated_at = excluded.updated_at
    `);
    const collections = {};
    for (const docs of Object.values(firestore)) {
      for (const doc of docs) {
        const { collection, id } = docPath(doc.name);
        upsertDoc.run(collection, id, JSON.stringify(decodeFields(doc.fields || {})), JSON.stringify(doc), doc.createTime, doc.updateTime);
        collections[collection] = (collections[collection] || 0) + 1;
      }
    }

    const upsertAccount = db.prepare(`
      INSERT INTO auth_accounts (uid, email, password_algo, password_hash, password_salt, google_sub,
        display_name, email_verified, disabled, created_at, last_login_at, firebase_raw)
      VALUES (:uid, :email, :password_algo, :password_hash, :password_salt, :google_sub,
        :display_name, :email_verified, :disabled, :created_at, :last_login_at, :firebase_raw)
      ON CONFLICT (uid) DO UPDATE SET
        email = excluded.email, password_algo = excluded.password_algo, password_hash = excluded.password_hash,
        password_salt = excluded.password_salt, google_sub = excluded.google_sub,
        display_name = excluded.display_name, email_verified = excluded.email_verified,
        disabled = excluded.disabled, created_at = excluded.created_at,
        last_login_at = excluded.last_login_at, firebase_raw = excluded.firebase_raw
    `);
    for (const user of authUsers) upsertAccount.run(accountRow(user));

    const check = verifyImport(db, { firestore, authUsers }, { exact: replace });
    if (!check.ok) throw new Error(`La verificación falló, no se importó nada:\n  ${check.problems.join('\n  ')}`);
    const report = { collections, accounts: authUsers.length };
    if (dryRun) throw new DryRunRollback(report);
    return report;
  });
}

// Compara la base contra el backup. `exact` además exige que no haya nada que
// no venga del backup (se usa en el corte final, con --replace).
export function verifyImport(db, { firestore, authUsers }, { exact = false } = {}) {
  const problems = [];
  const expected = new Set();

  const getDoc = db.prepare('SELECT data, raw FROM docs WHERE collection = ? AND id = ?');
  for (const docs of Object.values(firestore)) {
    for (const doc of docs) {
      const { collection, id } = docPath(doc.name);
      expected.add(`${collection}/${id}`);
      const row = getDoc.get(collection, id);
      if (!row) { problems.push(`${collection}/${id}: falta en la base`); continue; }
      if (!isDeepStrictEqual(JSON.parse(row.data), decodeFields(doc.fields || {}))) {
        problems.push(`${collection}/${id}: contenido distinto al backup`);
      }
      if (!isDeepStrictEqual(JSON.parse(row.raw), doc)) {
        problems.push(`${collection}/${id}: copia cruda distinta al backup`);
      }
    }
  }

  const getAccount = db.prepare('SELECT * FROM auth_accounts WHERE uid = ?');
  for (const user of authUsers) {
    const row = getAccount.get(user.localId);
    if (!row) { problems.push(`cuenta ${user.email}: falta en la base`); continue; }
    const want = accountRow(user);
    for (const key of ['email', 'password_algo', 'password_hash', 'password_salt', 'google_sub', 'firebase_raw']) {
      if (row[key] !== want[key]) problems.push(`cuenta ${user.email}: ${key} distinto al backup`);
    }
  }

  if (exact) {
    for (const row of db.prepare('SELECT collection, id FROM docs').all()) {
      if (!expected.has(`${row.collection}/${row.id}`)) problems.push(`${row.collection}/${row.id}: sobra (no está en el backup)`);
    }
    const uids = new Set(authUsers.map((u) => u.localId));
    for (const row of db.prepare('SELECT uid, email FROM auth_accounts').all()) {
      if (!uids.has(row.uid)) problems.push(`cuenta ${row.email}: sobra (no está en el backup)`);
    }
  }

  return { ok: problems.length === 0, problems };
}

export function loadBackup(dir) {
  const firestore = JSON.parse(readFileSync(join(dir, 'firestore.json'), 'utf8'));
  const authUsers = JSON.parse(readFileSync(join(dir, 'auth-users.json'), 'utf8')).users;
  return { firestore, authUsers };
}

function main() {
  const { values } = parseArgs({
    options: {
      backup: { type: 'string' },
      db: { type: 'string', default: process.env.DB_PATH || 'data/campo.sqlite' },
      replace: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.backup) throw new Error('Falta --backup <carpeta del backup>');

  const dbPath = resolve(values.db);
  const db = openDb(dbPath);
  if (existsSync(dbPath) && !values['dry-run']) {
    const snapshot = `${dbPath}.antes-de-import-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    db.exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
    console.log(`Copia previa de la base: ${snapshot}`);
  }

  const backup = loadBackup(values.backup);
  if (values['dry-run']) {
    const report = importBackup(db, backup, { replace: values.replace, dryRun: true });
    console.log('DRY RUN OK (nada se guardó):', report);
    return;
  }

  const report = importBackup(db, backup, { replace: values.replace });
  const again = verifyImport(db, backup, { exact: values.replace });
  console.log('Importado:', report);
  console.log(again.ok ? 'Verificación final: OK' : `Verificación final FALLÓ:\n${again.problems.join('\n')}`);
  if (!again.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
