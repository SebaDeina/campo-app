import { describe, it, expect } from 'vitest';
import { openDb, tx } from '../src/db.js';

describe('openDb', () => {
  it('crea el schema y es re-ejecutable', () => {
    const db = openDb(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['auth_accounts', 'docs', 'password_resets', 'sessions']));
    db.exec('PRAGMA user_version'); // no explota
  });

  it('expone campo_id derivado del JSON', () => {
    const db = openDb(':memory:');
    db.prepare('INSERT INTO docs (collection, id, data) VALUES (?, ?, ?)').run('ovejas', 'o1', JSON.stringify({ campoId: 'c1' }));
    expect(db.prepare('SELECT campo_id FROM docs WHERE id = ?').get('o1').campo_id).toBe('c1');
  });

  it('tx hace rollback si la función tira error', () => {
    const db = openDb(':memory:');
    expect(() => tx(db, () => {
      db.prepare('INSERT INTO docs (collection, id, data) VALUES (?, ?, ?)').run('x', '1', '{}');
      throw new Error('boom');
    })).toThrow('boom');
    expect(db.prepare('SELECT count(*) AS n FROM docs').get().n).toBe(0);
  });
});
