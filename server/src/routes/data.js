// API genérica para las colecciones que cuelgan de un campo. Es lo que usa el
// shim de Firestore del frontend (src/lib/db.js).
import { Router } from 'express';
import { HttpError, campoRole, canWrite, requireApproved } from '../access.js';
import { applyUpdate, materialize, runQuery, validateQuery } from '../docs-query.js';
import { deleteDoc, getDoc, listDocs, putDoc } from '../store.js';
import { newDocId } from '../ids.js';
import { tx } from '../db.js';

export const CAMPO_COLLECTIONS = new Set([
  'ovejas', 'ovejaHistorial', 'lluvias', 'tareas',
  'alimentos', 'alimentoMovimientos',
]);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function checkCollection(collection) {
  if (!CAMPO_COLLECTIONS.has(collection)) throw new HttpError(404, `Colección desconocida: ${collection}`);
}

function checkId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, 'ID de documento inválido');
}

function checkData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Datos inválidos');
}

export function dataRoutes({ db, config }) {
  const router = Router();

  function requireRole(campoId, uid, write) {
    const rol = campoRole(db, campoId, uid);
    if (!rol) throw new HttpError(403, 'No tenés acceso a ese campo', 'permission-denied');
    if (write && !canWrite(rol)) throw new HttpError(403, 'Tu rol en este campo es de solo lectura', 'permission-denied');
  }

  // Valida y aplica una operación. Se usa tanto suelta como dentro de un batch.
  function applyOp(uid, op) {
    checkCollection(op.collection);
    checkId(op.id);
    const existing = getDoc(db, op.collection, op.id);
    if (existing) requireRole(existing.campoId, uid, true);

    if (op.type === 'delete') {
      if (existing) deleteDoc(db, op.collection, op.id, uid);
      return null;
    }
    checkData(op.data);
    let next;
    if (op.type === 'set') {
      next = materialize(op.data);
    } else if (op.type === 'update') {
      if (!existing) throw new HttpError(404, 'El documento no existe', 'not-found');
      next = applyUpdate(existing, op.data);
    } else {
      throw new HttpError(400, `Operación desconocida: ${op.type}`);
    }
    if (existing && next.campoId !== existing.campoId) throw new HttpError(400, 'No se puede cambiar el campo de un documento');
    if (!existing) requireRole(next.campoId, uid, true);
    putDoc(db, op.collection, op.id, next);
    return { id: op.id, data: next };
  }

  router.post('/query', (req, res) => {
    const account = requireApproved(db, config, req);
    const { collection, where = [], orderBy = [], limit } = req.body || {};
    checkCollection(collection);
    validateQuery({ where, orderBy, limit });
    const campoFilter = where.find(([path, op]) => path === 'campoId' && op === '==');
    if (!campoFilter) throw new HttpError(400, "Las consultas tienen que filtrar por where('campoId', '==', ...)");
    requireRole(campoFilter[2], account.uid, false);
    const docs = listDocs(db, collection, 'AND campo_id = ?', campoFilter[2]);
    res.json(runQuery(docs, { where, orderBy, limit }));
  });

  // Antes que '/:collection' para que 'batch' no se tome como nombre de colección.
  router.post('/batch', (req, res) => {
    const account = requireApproved(db, config, req);
    const ops = req.body?.ops;
    if (!Array.isArray(ops) || ops.length > 500) throw new HttpError(400, 'Un batch lleva entre 0 y 500 operaciones');
    tx(db, () => ops.forEach((op) => applyOp(account.uid, op)));
    res.json({ ok: true, count: ops.length });
  });

  router.get('/:collection/:id', (req, res) => {
    const account = requireApproved(db, config, req);
    checkCollection(req.params.collection);
    const data = getDoc(db, req.params.collection, req.params.id);
    if (!data) return res.json({ id: req.params.id, data: null });
    requireRole(data.campoId, account.uid, false);
    res.json({ id: req.params.id, data });
  });

  router.post('/:collection', (req, res) => {
    const account = requireApproved(db, config, req);
    const result = tx(db, () => applyOp(account.uid, {
      type: 'set', collection: req.params.collection, id: newDocId(), data: req.body?.data,
    }));
    res.status(201).json(result);
  });

  router.put('/:collection/:id', (req, res) => {
    const account = requireApproved(db, config, req);
    res.json(tx(db, () => applyOp(account.uid, {
      type: 'set', collection: req.params.collection, id: req.params.id, data: req.body?.data,
    })));
  });

  router.patch('/:collection/:id', (req, res) => {
    const account = requireApproved(db, config, req);
    res.json(tx(db, () => applyOp(account.uid, {
      type: 'update', collection: req.params.collection, id: req.params.id, data: req.body?.data,
    })));
  });

  router.delete('/:collection/:id', (req, res) => {
    const account = requireApproved(db, config, req);
    tx(db, () => applyOp(account.uid, { type: 'delete', collection: req.params.collection, id: req.params.id }));
    res.json({ ok: true });
  });

  return router;
}
