import { DatabaseSync } from 'node:sqlite';

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

// Cada entrada es una migración; el índice + 1 es su user_version.
const MIGRATIONS = [
  `
  CREATE TABLE docs (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    raw        TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    campo_id   TEXT GENERATED ALWAYS AS (json_extract(data, '$.campoId')) VIRTUAL,
    PRIMARY KEY (collection, id)
  );
  CREATE INDEX docs_campo ON docs (collection, campo_id);

  CREATE TABLE auth_accounts (
    uid            TEXT PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_algo  TEXT,
    password_hash  TEXT,
    password_salt  TEXT,
    google_sub     TEXT UNIQUE,
    display_name   TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    disabled       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    last_login_at  TEXT,
    firebase_raw   TEXT
  );

  CREATE TABLE sessions (
    id_hash    TEXT PRIMARY KEY,
    uid        TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_uid ON sessions (uid);

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    uid        TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at    TEXT
  );
  `,
  // Los borrados definitivos se guardan acá: nada se pierde aunque se vacíe la papelera.
  `
  CREATE TABLE deleted_docs (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    raw        TEXT,
    created_at TEXT,
    deleted_at TEXT NOT NULL DEFAULT ${NOW},
    deleted_by TEXT
  );
  CREATE INDEX deleted_docs_ref ON deleted_docs (collection, id);
  `,
];

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = current; i < MIGRATIONS.length; i++) {
    tx(db, () => {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
  return db;
}

// Transacción síncrona: commit si fn termina, rollback si tira.
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
