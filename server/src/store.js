// Acceso a documentos: lectura/escritura del JSON guardado en la tabla `docs`.

export function getDoc(db, collection, id) {
  const row = db.prepare('SELECT data FROM docs WHERE collection = ? AND id = ?').get(collection, id);
  return row ? JSON.parse(row.data) : null;
}

export function putDoc(db, collection, id, data) {
  db.prepare(`
    INSERT INTO docs (collection, id, data) VALUES (?, ?, ?)
    ON CONFLICT (collection, id) DO UPDATE SET
      data = excluded.data, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(collection, id, JSON.stringify(data));
}

// Mueve el documento a deleted_docs antes de sacarlo de docs.
export function deleteDoc(db, collection, id, deletedBy = null) {
  db.prepare(`
    INSERT INTO deleted_docs (collection, id, data, raw, created_at, deleted_by)
    SELECT collection, id, data, raw, created_at, ? FROM docs WHERE collection = ? AND id = ?
  `).run(deletedBy, collection, id);
  return db.prepare('DELETE FROM docs WHERE collection = ? AND id = ?').run(collection, id).changes > 0;
}

export function listDocs(db, collection, where = '', ...params) {
  return db.prepare(`SELECT id, data FROM docs WHERE collection = ? ${where}`)
    .all(collection, ...params)
    .map((row) => ({ id: row.id, data: JSON.parse(row.data) }));
}
