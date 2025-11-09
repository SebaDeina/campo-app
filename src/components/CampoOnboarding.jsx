import { useState } from 'react';
import { useCampo } from '../firebase/CampoContext';
import { Settings, MapPin, LogIn } from 'lucide-react';

export default function CampoOnboarding() {
  const {
    createCampo,
    invitaciones,
    loadingInvitaciones,
    acceptInvite,
    rejectInvite
  } = useCampo();
  const [campoNombre, setCampoNombre] = useState('');
  const [status, setStatus] = useState(null);
  const [inviteStatus, setInviteStatus] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await createCampo(campoNombre);
      setCampoNombre('');
      setStatus({ type: 'success', message: 'Campo creado correctamente. ¡Ya podés empezar a cargar datos!' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'No se pudo crear el campo.' });
    }
  }

  async function handleInviteAction(action, inviteId) {
    setInviteStatus(null);
    try {
      if (action === 'accept') {
        await acceptInvite(inviteId);
        setInviteStatus({ type: 'success', message: 'Te uniste al campo.' });
      } else {
        await rejectInvite(inviteId);
        setInviteStatus({ type: 'info', message: 'Invitación rechazada.' });
      }
    } catch (error) {
      setInviteStatus({ type: 'error', message: error.message || 'No se pudo procesar la invitación.' });
    }
  }

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '40px' }}>🐑</div>
          <h1>Bienvenido a Campo App</h1>
          <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
            Crea tu primer campo o acepta una invitación para comenzar a registrar tus datos.
          </p>
        </div>

        {status && (
          <div className={`alert ${status.type === 'error' ? 'alert-error' : 'alert-success'}`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleCreate} className="input-group">
          <label>Nombre del campo</label>
          <input
            type="text"
            placeholder="Ej: Establecimiento San Pedro"
            value={campoNombre}
            onChange={(e) => setCampoNombre(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            <Settings size={16} />
            Crear mi campo
          </button>
        </form>

        <div style={{ margin: '30px 0', borderTop: '1px solid var(--border)' }} />

        <h2 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={18} />
          Invitaciones pendientes
        </h2>

        {inviteStatus && (
          <div className={`alert ${inviteStatus.type === 'error' ? 'alert-error' : inviteStatus.type === 'success' ? 'alert-success' : 'alert-info'}`}>
            {inviteStatus.message}
          </div>
        )}

        {loadingInvitaciones ? (
          <p style={{ color: 'var(--text-secondary)' }}>Cargando invitaciones...</p>
        ) : invitaciones.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            Si otro usuario te invita, verás la solicitud aquí para unirte con un clic.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {invitaciones.map((inv) => (
              <div key={inv.id} className="card" style={{ background: 'var(--background)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{inv.campoNombre}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Rol: {inv.rol || 'editor'} · Invitado por {inv.invitedByEmail}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={() => handleInviteAction('accept', inv.id)}>
                      <LogIn size={16} />
                      Aceptar
                    </button>
                    <button className="btn" style={{ background: '#eee' }} onClick={() => handleInviteAction('decline', inv.id)}>
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
