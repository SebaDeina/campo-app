import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (password !== confirm) return setError('Las contraseñas deben coincidir');
    setSaving(true);
    try {
      await api('/auth/reset/confirm', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #2e7d32 0%, #558b2f 100%)',
      padding: '30px 15px'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '35px 30px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: '20px' }}>Nueva contraseña</h2>

        {!token && <div className="alert alert-error">El enlace no es válido. Pedí uno nuevo desde el login.</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {done ? (
          <>
            <div className="alert alert-success">Listo, tu contraseña se cambió.</div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
              Ir a iniciar sesión
            </button>
          </>
        ) : token && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Contraseña nueva</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </div>
            <div className="form-group">
              <label>Repetila</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
