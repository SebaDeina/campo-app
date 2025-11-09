import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  arrayUnion,
  arrayRemove,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { useAuth } from './AuthContext';

const CampoContext = createContext();

function normalizeEmail(email) {
  return email?.trim().toLowerCase() || '';
}

export function CampoProvider({ children }) {
  const { currentUser } = useAuth();
  const [campos, setCampos] = useState([]);
  const [selectedCampoId, setSelectedCampoId] = useState(() => localStorage.getItem('campoAppSelectedCampo'));
  const [loadingCampos, setLoadingCampos] = useState(true);
  const [invitaciones, setInvitaciones] = useState([]);
  const [loadingInvitaciones, setLoadingInvitaciones] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setCampos([]);
      setSelectedCampoId(null);
      setLoadingCampos(false);
      return;
    }

    const camposQuery = query(collection(db, 'campos'), where('miembrosIds', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(camposQuery, (snapshot) => {
      const lista = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setCampos(lista);
      setLoadingCampos(false);

      if (!lista.length) {
        setSelectedCampoId(null);
        localStorage.removeItem('campoAppSelectedCampo');
        return;
      }

      const stored = localStorage.getItem('campoAppSelectedCampo');
      const preferredId = stored && lista.find((campo) => campo.id === stored) ? stored : null;
      const currentValid = selectedCampoId && lista.find((campo) => campo.id === selectedCampoId) ? selectedCampoId : null;
      const nextId = preferredId || currentValid || lista[0].id;

      if (nextId) {
        setSelectedCampoId(nextId);
        localStorage.setItem('campoAppSelectedCampo', nextId);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.email) {
      setInvitaciones([]);
      setLoadingInvitaciones(false);
      return;
    }

    const invitacionesQuery = query(
      collection(db, 'campoInvitaciones'),
      where('emailLower', '==', normalizeEmail(currentUser.email)),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(invitacionesQuery, (snapshot) => {
      setInvitaciones(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setLoadingInvitaciones(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  function selectCampo(campoId) {
    setSelectedCampoId(campoId);
    if (campoId) {
      localStorage.setItem('campoAppSelectedCampo', campoId);
    } else {
      localStorage.removeItem('campoAppSelectedCampo');
    }
  }

  async function createCampo(nombre) {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    const trimmed = nombre.trim();
    if (!trimmed) throw new Error('El nombre del campo es obligatorio');

    const docRef = await addDoc(collection(db, 'campos'), {
      nombre: trimmed,
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email,
      miembrosIds: [currentUser.uid],
      miembros: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || '',
          rol: 'owner',
        },
      },
      createdAt: serverTimestamp(),
    });

    selectCampo(docRef.id);
  }

  async function inviteUsuario(campoId, email, rol = 'editor') {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    const campo = campos.find((c) => c.id === campoId);
    if (!campo) throw new Error('Campo no encontrado');

    await addDoc(collection(db, 'campoInvitaciones'), {
      campoId,
      campoNombre: campo.nombre,
      email: email.trim(),
      emailLower: normalizeEmail(email),
      rol,
      status: 'pending',
      invitedBy: currentUser.uid,
      invitedByEmail: currentUser.email,
      createdAt: serverTimestamp(),
    });
  }

  async function acceptInvite(inviteId) {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    const inviteRef = doc(db, 'campoInvitaciones', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invitación no encontrada');
    const inviteData = inviteSnap.data();

    const campoRef = doc(db, 'campos', inviteData.campoId);
    await updateDoc(campoRef, {
      [`miembros.${currentUser.uid}`]: {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        rol: inviteData.rol || 'editor',
      },
      miembrosIds: arrayUnion(currentUser.uid),
    });

    await updateDoc(inviteRef, {
      status: 'accepted',
      respondedAt: serverTimestamp(),
    });

    selectCampo(inviteData.campoId);
  }

  async function rejectInvite(inviteId) {
    const inviteRef = doc(db, 'campoInvitaciones', inviteId);
    await updateDoc(inviteRef, {
      status: 'declined',
      respondedAt: serverTimestamp(),
    });
  }

  async function updateMiembroRol(campoId, miembroUid, nuevoRol) {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    const campo = campos.find((c) => c.id === campoId);
    if (!campo) throw new Error('Campo no encontrado');
    const esOwnerActual = campo.miembros?.[currentUser.uid]?.rol === 'owner';
    if (!esOwnerActual) throw new Error('Solo el owner puede modificar roles');
    if (!campo.miembros?.[miembroUid]) throw new Error('Miembro no encontrado');
    if (miembroUid === campo.ownerId) throw new Error('No puedes modificar el rol del owner');

    const campoRef = doc(db, 'campos', campoId);
    await updateDoc(campoRef, {
      [`miembros.${miembroUid}.rol`]: nuevoRol,
    });
  }

  async function removeMiembro(campoId, miembroUid) {
    if (!currentUser) throw new Error('Debes iniciar sesión');
    const campo = campos.find((c) => c.id === campoId);
    if (!campo) throw new Error('Campo no encontrado');
    const esOwnerActual = campo.miembros?.[currentUser.uid]?.rol === 'owner';
    if (!esOwnerActual) throw new Error('Solo el owner puede quitar miembros');
    if (miembroUid === campo.ownerId) throw new Error('No puedes quitar al owner');
    if (!campo.miembros?.[miembroUid]) throw new Error('Miembro no encontrado');

    const campoRef = doc(db, 'campos', campoId);
    await updateDoc(campoRef, {
      [`miembros.${miembroUid}`]: deleteField(),
      miembrosIds: arrayRemove(miembroUid),
    });
  }

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
    [campos, selectedCampoId, loadingCampos, invitaciones, loadingInvitaciones]
  );

  return <CampoContext.Provider value={value}>{children}</CampoContext.Provider>;
}

export function useCampo() {
  return useContext(CampoContext);
}
