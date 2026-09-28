// Campos, miembros e invitaciones: lo que antes hacía CampoContext directo contra Firestore.
import { Router } from 'express';
import { HttpError, campoRole, camposOf, requireApproved, requireAuth } from '../access.js';
import { getDoc, listDocs, putDoc } from '../store.js';
import { newDocId } from '../ids.js';
import { nowTimestamp } from '../codec.js';
import { tx } from '../db.js';

const ROLES = new Set(['owner', 'editor', 'viewer']);
const INVITE_ROLES = new Set(['editor', 'viewer']);

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function camposRoutes({ db, config }) {
  const router = Router();

  function ownedCampo(campoId, uid) {
    const campo = getDoc(db, 'campos', campoId);
    if (!campo) throw new HttpError(404, 'Campo no encontrado');
    if (campoRole(db, campoId, uid) !== 'owner') throw new HttpError(403, 'Solo el owner puede hacer esto', 'permission-denied');
    return campo;
  }

  function pendingInviteFor(inviteId, account) {
    const invite = getDoc(db, 'campoInvitaciones', inviteId);
    if (!invite) throw new HttpError(404, 'Invitación no encontrada');
    if (invite.emailLower !== normalizeEmail(account.email)) throw new HttpError(403, 'La invitación es para otro email');
    if (invite.status !== 'pending') throw new HttpError(409, 'La invitación ya fue respondida');
    return invite;
  }

  router.get('/campos', (req, res) => {
    const account = requireAuth(req);
    res.json(camposOf(db, account.uid).map(({ id, data }) => ({ id, ...data })));
  });

  router.post('/campos', (req, res) => {
    const account = requireApproved(db, config, req);
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre) throw new HttpError(400, 'El nombre del campo es obligatorio');
    const id = newDocId();
    const displayName = account.display_name || getDoc(db, 'users', account.uid)?.displayName || '';
    const campo = {
      nombre,
      ownerId: account.uid,
      ownerEmail: account.email,
      miembrosIds: [account.uid],
      miembros: { [account.uid]: { uid: account.uid, email: account.email, displayName, rol: 'owner' } },
      createdAt: nowTimestamp(),
    };
    putDoc(db, 'campos', id, campo);
    res.status(201).json({ id, ...campo });
  });

  router.patch('/campos/:id/miembros/:uid', (req, res) => {
    const account = requireApproved(db, config, req);
    const rol = req.body?.rol;
    if (!ROLES.has(rol) || rol === 'owner') throw new HttpError(400, 'Rol inválido');
    tx(db, () => {
      const campo = ownedCampo(req.params.id, account.uid);
      if (!campo.miembros?.[req.params.uid]) throw new HttpError(404, 'Miembro no encontrado');
      if (req.params.uid === campo.ownerId) throw new HttpError(400, 'No podés modificar el rol del owner');
      campo.miembros[req.params.uid].rol = rol;
      putDoc(db, 'campos', req.params.id, campo);
    });
    res.json({ ok: true });
  });

  router.delete('/campos/:id/miembros/:uid', (req, res) => {
    const account = requireApproved(db, config, req);
    tx(db, () => {
      const campo = ownedCampo(req.params.id, account.uid);
      if (req.params.uid === campo.ownerId) throw new HttpError(400, 'No podés quitar al owner');
      if (!campo.miembros?.[req.params.uid]) throw new HttpError(404, 'Miembro no encontrado');
      delete campo.miembros[req.params.uid];
      campo.miembrosIds = campo.miembrosIds.filter((uid) => uid !== req.params.uid);
      putDoc(db, 'campos', req.params.id, campo);
    });
    res.json({ ok: true });
  });

  router.post('/campos/:id/invitaciones', (req, res) => {
    const account = requireApproved(db, config, req);
    const campo = getDoc(db, 'campos', req.params.id);
    const myRole = campoRole(db, req.params.id, account.uid);
    if (!campo || !myRole) throw new HttpError(404, 'Campo no encontrado');
    if (myRole === 'viewer') throw new HttpError(403, 'Tu rol en este campo es de solo lectura', 'permission-denied');
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const rol = req.body?.rol || 'editor';
    if (!email.includes('@')) throw new HttpError(400, 'Email inválido');
    if (!INVITE_ROLES.has(rol)) throw new HttpError(400, 'Rol inválido');
    const id = newDocId();
    const invite = {
      campoId: req.params.id,
      campoNombre: campo.nombre,
      email,
      emailLower: normalizeEmail(email),
      rol,
      status: 'pending',
      invitedBy: account.uid,
      invitedByEmail: account.email,
      createdAt: nowTimestamp(),
    };
    putDoc(db, 'campoInvitaciones', id, invite);
    res.status(201).json({ id, ...invite });
  });

  router.get('/invitaciones', (req, res) => {
    const account = requireAuth(req);
    const docs = listDocs(db, 'campoInvitaciones',
      "AND json_extract(data, '$.emailLower') = ? AND json_extract(data, '$.status') = 'pending'",
      normalizeEmail(account.email));
    res.json(docs.map(({ id, data }) => ({ id, ...data })));
  });

  router.post('/invitaciones/:id/accept', (req, res) => {
    const account = requireAuth(req);
    const campoId = tx(db, () => {
      const invite = pendingInviteFor(req.params.id, account);
      const campo = getDoc(db, 'campos', invite.campoId);
      if (!campo) throw new HttpError(404, 'El campo ya no existe');
      campo.miembros = {
        ...campo.miembros,
        [account.uid]: {
          uid: account.uid,
          email: account.email,
          displayName: account.display_name || '',
          rol: INVITE_ROLES.has(invite.rol) ? invite.rol : 'editor',
        },
      };
      if (!campo.miembrosIds.includes(account.uid)) campo.miembrosIds = [...campo.miembrosIds, account.uid];
      putDoc(db, 'campos', invite.campoId, campo);
      putDoc(db, 'campoInvitaciones', req.params.id, { ...invite, status: 'accepted', respondedAt: nowTimestamp() });
      return invite.campoId;
    });
    res.json({ ok: true, campoId });
  });

  router.post('/invitaciones/:id/reject', (req, res) => {
    const account = requireAuth(req);
    tx(db, () => {
      const invite = pendingInviteFor(req.params.id, account);
      putDoc(db, 'campoInvitaciones', req.params.id, { ...invite, status: 'declined', respondedAt: nowTimestamp() });
    });
    res.json({ ok: true });
  });

  return router;
}
