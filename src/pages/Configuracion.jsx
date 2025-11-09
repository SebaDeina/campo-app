import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../firebase/AuthContext';
import { auth } from '../firebase/config';
import LocationSettings from '../components/LocationSettings';
import { useCampo } from '../firebase/CampoContext';

export default function Configuracion() {
  const { currentUser } = useAuth();
  const routerLocation = useLocation();
  const ubicacionRef = useRef(null);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
  const [status, setStatus] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [campoNombre, setCampoNombre] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRol, setInviteRol] = useState('editor');
  const [campoStatus, setCampoStatus] = useState(null);
  const {
    campos,
    selectedCampoId,
    selectCampo,
    createCampo,
    inviteUsuario,
    updateMiembroRol,
    removeMiembro,
    invitaciones,
    acceptInvite,
    rejectInvite,
    loadingCampos,
    loadingInvitaciones
  } = useCampo();

  const selectedCampo = campos.find((campo) => campo.id === selectedCampoId);
  const miembros = selectedCampo ? Object.values(selectedCampo.miembros || {}) : [];
  const esOwner = selectedCampo?.miembros?.[currentUser.uid]?.rol === 'owner';
  const [memberActions, setMemberActions] = useState({});
  const [editedRoles, setEditedRoles] = useState({});
  const [savingRoles, setSavingRoles] = useState(false);
  const ROL_OPTIONS = [
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Solo lectura' }
  ];
  const ROL_LABELS = {
    owner: 'Owner',
    editor: 'Editor',
    viewer: 'Solo lectura'
  };

  const setMemberAction = (uid, action) =>
    setMemberActions((prev) => ({
      ...prev,
      [uid]: action
    }));

  const clearMemberAction = (uid) =>
    setMemberActions((prev) => {
      const updated = { ...prev };
      delete updated[uid];
      return updated;
    });

  const cambiosRolPendientes = useMemo(() => {
    if (!selectedCampo || !esOwner) return [];
    return Object.entries(editedRoles).filter(([uid, rol]) => {
      const actual = selectedCampo.miembros?.[uid]?.rol || 'editor';
      return rol && rol !== actual;
    });
  }, [editedRoles, selectedCampo, esOwner]);

  const hayCambiosRol = cambiosRolPendientes.length > 0;

  useEffect(() => {
    setEditedRoles({});
    setSavingRoles(false);
  }, [selectedCampoId]);

  async function handleSaveRoles() {
    if (!selectedCampoId || !hayCambiosRol) return;
    setSavingRoles(true);
    setCampoStatus(null);
    try {
      for (const [miembroUid, nuevoRol] of cambiosRolPendientes) {
        await updateMiembroRol(selectedCampoId, miembroUid, nuevoRol);
      }
      setEditedRoles((prev) => {
        const copy = { ...prev };
        cambiosRolPendientes.forEach(([uid]) => {
          delete copy[uid];
        });
        return copy;
      });
      setCampoStatus({ type: 'success', message: 'Roles actualizados correctamente.' });
    } catch (error) {
      setCampoStatus({ type: 'error', message: error.message || 'No se pudieron actualizar los roles.' });
    } finally {
      setSavingRoles(false);
    }
  }

  async function handleRemoveMiembro(miembroUid) {
    if (!selectedCampoId) return;
    setMemberAction(miembroUid, 'remove');
    setCampoStatus(null);
    try {
      await removeMiembro(selectedCampoId, miembroUid);
      setCampoStatus({ type: 'success', message: 'Miembro eliminado del campo.' });
    } catch (error) {
      setCampoStatus({ type: 'error', message: error.message || 'No se pudo eliminar al miembro.' });
    } finally {
      clearMemberAction(miembroUid);
    }
  }

  useEffect(() => {
    if (routerLocation.hash === '#ubicacion' && ubicacionRef.current) {
      ubicacionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [routerLocation]);

  if (!currentUser) {
    return (
      <div className="container">
        <div className="card">
          <p>Debes iniciar sesión para ver esta sección.</p>
        </div>
      </div>
    );
  }

  async function handleProfileUpdate(e) {
    e.preventDefault();
    setSavingProfile(true);
    setStatus(null);

    try {
      await updateProfile(currentUser, {
        displayName: displayName.trim() || null,
        photoURL: photoURL.trim() || null
      });

      setStatus({ type: 'success', message: 'Perfil actualizado correctamente.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'No se pudo actualizar el perfil.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordReset() {
    setSendingReset(true);
    setStatus(null);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setStatus({ type: 'info', message: 'Te enviamos un correo para restablecer la contraseña.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'No se pudo enviar el correo.' });
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="container">
      <h1 style={{ marginBottom: '30px' }}>Perfil y Configuración</h1>

      {status && (
        <div 
          className={`alert ${
            status.type === 'error' ? 'alert-error' : 
            status.type === 'success' ? 'alert-success' : 
            'alert-info'
          }`}
          style={{ marginBottom: '20px' }}
        >
          {status.message}
        </div>
      )}

      <div className="card" style={{ marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '15px' }}>Información de la cuenta</h2>
        <form onSubmit={handleProfileUpdate} className="grid grid-2">
          <div className="input-group">
            <label>Nombre para mostrar</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Campo App"
            />
          </div>
          <div className="input-group">
            <label>Foto (URL)</label>
            <input
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={currentUser.email} disabled />
          </div>
          <div className="input-group">
            <label>Contraseña</label>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handlePasswordReset}
              disabled={sendingReset}
            >
              {sendingReset ? 'Enviando...' : 'Enviar correo de restablecimiento'}
            </button>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '15px' }}>Mis Campos</h2>
        {campoStatus && (
          <div
            className={`alert ${
              campoStatus.type === 'error' ? 'alert-error' : campoStatus.type === 'success' ? 'alert-success' : 'alert-info'
            }`}
            style={{ marginBottom: '15px' }}
          >
            {campoStatus.message}
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createCampo(campoNombre);
              setCampoNombre('');
              setCampoStatus({ type: 'success', message: 'Campo creado correctamente.' });
            } catch (error) {
              setCampoStatus({ type: 'error', message: error.message || 'No se pudo crear el campo.' });
            }
          }}
          style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}
        >
          <input
            type="text"
            placeholder="Nombre del campo"
            value={campoNombre}
            onChange={(e) => setCampoNombre(e.target.value)}
            style={{ flex: '1 1 200px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}
          />
          <button type="submit" className="btn btn-primary">
            Crear campo
          </button>
        </form>

        {loadingCampos ? (
          <p style={{ color: 'var(--text-secondary)' }}>Cargando campos...</p>
        ) : campos.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Aún no tienes campos. ¡Crea el primero!</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {campos.map((campo) => (
              <button
                key={campo.id}
                onClick={() => selectCampo(campo.id)}
                className="btn"
                style={{
                  flex: '1 1 220px',
                  border: campo.id === selectedCampoId ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: campo.id === selectedCampoId ? 'var(--primary)' : 'white',
                  color: campo.id === selectedCampoId ? 'white' : 'var(--text)'
                }}
              >
                {campo.nombre}
                {campo.ownerId === currentUser.uid && ' (Owner)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCampo && (
        <div className="card" style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '15px' }}>Miembros de {selectedCampo.nombre}</h2>
          {miembros.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Sin miembros registrados.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    {esOwner && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {miembros.map((miembro) => (
                    <tr key={miembro.uid}>
                      <td>{miembro.displayName || 'Sin nombre'}</td>
                      <td>{miembro.email}</td>
                      <td>
                        {esOwner && miembro.uid !== selectedCampo.ownerId ? (
                          <select
                            value={(editedRoles[miembro.uid] ?? miembro.rol) || 'editor'}
                            onChange={(e) =>
                              setEditedRoles((prev) => ({
                                ...prev,
                                [miembro.uid]: e.target.value
                              }))
                            }
                          >
                            {ROL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ textTransform: 'capitalize' }}>{ROL_LABELS[miembro.rol] || miembro.rol || 'Editor'}</span>
                        )}
                      </td>
                      {esOwner && (
                        <td>
                          {miembro.uid === selectedCampo.ownerId ? (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Owner</span>
                          ) : (
                            <button
                              className="btn"
                              style={{ background: '#fef2f2', color: '#b91c1c' }}
                              onClick={(event) => {
                                if (event.detail < 2) {
                                  setCampoStatus({
                                    type: 'info',
                                    message: 'Haz doble clic para confirmar que quieres quitar a este miembro.'
                                  });
                                  return;
                                }
                                handleRemoveMiembro(miembro.uid);
                              }}
                              disabled={memberActions[miembro.uid] === 'remove'}
                            >
                              {memberActions[miembro.uid] === 'remove' ? 'Quitando...' : 'Quitar'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {esOwner && hayCambiosRol && (
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Tienes cambios pendientes en los roles.
              </span>
              <button
                className="btn btn-primary"
                onClick={handleSaveRoles}
                disabled={savingRoles}
              >
                {savingRoles ? 'Guardando roles...' : 'Guardar cambios'}
              </button>
            </div>
          )}

          {esOwner && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await inviteUsuario(selectedCampoId, inviteEmail, inviteRol);
                  setInviteEmail('');
                  setInviteRol('editor');
                  setCampoStatus({ type: 'success', message: 'Invitación enviada.' });
                } catch (error) {
                  setCampoStatus({ type: 'error', message: error.message || 'No se pudo enviar la invitación.' });
                }
              }}
              style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}
            >
              <div className="input-group" style={{ flex: '1 1 220px' }}>
                <label>Email a invitar</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@correo.com"
                  required
                />
              </div>
              <div className="input-group" style={{ width: '160px' }}>
                <label>Rol</label>
                <select value={inviteRol} onChange={(e) => setInviteRol(e.target.value)}>
                  <option value="editor">Editor</option>
                  <option value="viewer">Solo lectura</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', height: '42px' }}>
                Invitar
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '15px' }}>Invitaciones pendientes</h2>
        {loadingInvitaciones ? (
          <p style={{ color: 'var(--text-secondary)' }}>Cargando invitaciones...</p>
        ) : invitaciones.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No tienes invitaciones pendientes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {invitaciones.map((inv) => (
              <div key={inv.id} className="card" style={{ background: 'var(--background)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p><strong>{inv.campoNombre}</strong></p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Rol: {inv.rol || 'editor'} · Invitado por {inv.invitedByEmail}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={() => acceptInvite(inv.id)}>
                      Aceptar
                    </button>
                    <button className="btn" style={{ background: '#eee' }} onClick={() => rejectInvite(inv.id)}>
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="config-ubicacion" ref={ubicacionRef}>
        <LocationSettings
          title="Ubicación del campo"
          description="Actualiza las coordenadas que se utilizan en la sección de clima y pronóstico."
        />
      </div>
    </div>
  );
}
