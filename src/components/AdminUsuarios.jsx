import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—';
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);

  async function load() {
    try {
      setUsuarios(await api('/admin/users'));
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setApproval(uid, isApproved) {
    setSaving(uid);
    try {
      await api(`/admin/users/${uid}/approval`, { method: 'POST', body: { isApproved } });
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(null);
    }
  }

  const pendientes = usuarios.filter((u) => !u.isApproved);

  return (
    <div className="card" style={{ marginTop: '30px' }}>
      <h2 style={{ marginBottom: '10px' }}>Usuarios</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
        {pendientes.length
          ? `${pendientes.length} esperando aprobación. Quien ya es miembro de un campo queda aprobado automáticamente.`
          : 'No hay usuarios esperando aprobación.'}
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">Cargando usuarios...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {usuarios.map((u) => (
            <div key={u.uid} className="card" style={{ background: 'var(--background)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <strong>{u.displayName || u.email}</strong>
                  {u.isAdmin && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--primary)' }}>admin</span>}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {u.email} · {u.providers.join(' + ') || 'sin método de login'} · alta {formatDate(u.createdAt)} · último ingreso {formatDate(u.lastLoginAt)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {u.campos.length ? `Campos: ${u.campos.join(', ')}` : 'Sin campos'}
                  </div>
                </div>
                {u.isApproved ? (
                  u.approvedManually && !u.campos.length && !u.isAdmin ? (
                    <button className="btn" style={{ background: '#eee' }} disabled={saving === u.uid} onClick={() => setApproval(u.uid, false)}>
                      Quitar aprobación
                    </button>
                  ) : (
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Aprobado</span>
                  )
                ) : (
                  <button className="btn btn-primary" disabled={saving === u.uid} onClick={() => setApproval(u.uid, true)}>
                    {saving === u.uid ? 'Aprobando...' : 'Aprobar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
