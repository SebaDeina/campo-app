import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const CampoContext = createContext();
const STORAGE_KEY = 'campoAppSelectedCampo';
const REFRESH_MS = 30_000;

function readStoredCampo() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCampo(campoId) {
  try {
    if (campoId) localStorage.setItem(STORAGE_KEY, campoId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin localStorage (modo privado): la selección vale solo para esta pestaña.
  }
}

export function CampoProvider({ children }) {
  const { currentUser, refreshUser } = useAuth();
  const [campos, setCampos] = useState([]);
  const [selectedCampoId, setSelectedCampoId] = useState(readStoredCampo);
  const [loadingCampos, setLoadingCampos] = useState(true);
  const [invitaciones, setInvitaciones] = useState([]);
  const [loadingInvitaciones, setLoadingInvitaciones] = useState(true);

  const selectCampo = useCallback((campoId) => {
    setSelectedCampoId(campoId);
    storeCampo(campoId);
  }, []);

  const loadCampos = useCallback(async () => {
    const lista = await api('/campos');
    setCampos(lista);
    setLoadingCampos(false);
    setSelectedCampoId((current) => {
      if (!lista.length) {
        storeCampo(null);
        return null;
      }
      const stored = readStoredCampo();
      const next = [stored, current].find((id) => id && lista.some((campo) => campo.id === id)) || lista[0].id;
      storeCampo(next);
      return next;
    });
    return lista;
  }, []);

  const loadInvitaciones = useCallback(async () => {
    setInvitaciones(await api('/invitaciones'));
    setLoadingInvitaciones(false);
  }, []);

  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      setCampos([]);
      setSelectedCampoId(null);
      setLoadingCampos(false);
      setInvitaciones([]);
      setLoadingInvitaciones(false);
      return undefined;
    }

    setLoadingCampos(true);
    setLoadingInvitaciones(true);
    const refresh = () => {
      loadCampos().catch((error) => console.error('Error cargando campos:', error));
      loadInvitaciones().catch((error) => console.error('Error cargando invitaciones:', error));
    };
    refresh();

    // Reemplaza el tiempo real de Firestore: refresco periódico y al volver a la pestaña.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, loadCampos, loadInvitaciones]);

  const createCampo = useCallback(async (nombre) => {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    if (!nombre.trim()) throw new Error('El nombre del campo es obligatorio');
    const campo = await api('/campos', { method: 'POST', body: { nombre } });
    await loadCampos();
    selectCampo(campo.id);
  }, [currentUser, loadCampos, selectCampo]);

  const inviteUsuario = useCallback(async (campoId, email, rol = 'editor') => {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    await api(`/campos/${campoId}/invitaciones`, { method: 'POST', body: { email, rol } });
  }, [currentUser]);

  const acceptInvite = useCallback(async (inviteId) => {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    const { campoId } = await api(`/invitaciones/${inviteId}/accept`, { method: 'POST' });
    // Al sumarse a un campo la cuenta queda aprobada.
    await refreshUser();
    await Promise.all([loadCampos(), loadInvitaciones()]);
    selectCampo(campoId);
  }, [currentUser, refreshUser, loadCampos, loadInvitaciones, selectCampo]);

  const rejectInvite = useCallback(async (inviteId) => {
    await api(`/invitaciones/${inviteId}/reject`, { method: 'POST' });
    await loadInvitaciones();
  }, [loadInvitaciones]);

  const updateMiembroRol = useCallback(async (campoId, miembroUid, nuevoRol) => {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    await api(`/campos/${campoId}/miembros/${miembroUid}`, { method: 'PATCH', body: { rol: nuevoRol } });
    await loadCampos();
  }, [currentUser, loadCampos]);

  const removeMiembro = useCallback(async (campoId, miembroUid) => {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    await api(`/campos/${campoId}/miembros/${miembroUid}`, { method: 'DELETE' });
    await loadCampos();
  }, [currentUser, loadCampos]);

  const value = useMemo(
    () => ({
      campos,
      selectedCampoId,
      loadingCampos,
      invitaciones,
      loadingInvitaciones,
      selectCampo,
      createCampo,
      inviteUsuario,
      acceptInvite,
      rejectInvite,
      updateMiembroRol,
      removeMiembro,
    }),
    [campos, selectedCampoId, loadingCampos, invitaciones, loadingInvitaciones, selectCampo, createCampo,
      inviteUsuario, acceptInvite, rejectInvite, updateMiembroRol, removeMiembro]
  );

  return <CampoContext.Provider value={value}>{children}</CampoContext.Provider>;
}

export function useCampo() {
  return useContext(CampoContext);
}
