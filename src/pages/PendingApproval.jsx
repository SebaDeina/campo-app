import { useState } from 'react';
import { useAuth } from '../firebase/AuthContext';
import { useCampo } from '../firebase/CampoContext';
import { Navigate, useNavigate } from 'react-router-dom';

export default function PendingApproval() {
    const { logout, currentUser } = useAuth();
    const { invitaciones, acceptInvite } = useCampo();
    const [accepting, setAccepting] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    // Aceptar una invitación suma al usuario a un campo, y eso lo aprueba.
    async function handleAccept(inviteId) {
        setAccepting(inviteId);
        setError('');
        try {
            await acceptInvite(inviteId);
            navigate('/app');
        } catch (err) {
            setError(err.message || 'No se pudo aceptar la invitación.');
        } finally {
            setAccepting(null);
        }
    }

    if (currentUser?.isApproved) {
        return <Navigate to="/app" replace />;
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #2e7d32 0%, #558b2f 100%)',
            padding: '20px'
        }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px 30px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
                <h2 style={{ color: 'var(--primary)', marginBottom: '15px' }}>Cuenta Pendiente</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '25px', lineHeight: '1.6' }}>
                    Hola <strong>{currentUser?.displayName || currentUser?.email}</strong>,<br />
                    Tu cuenta ha sido creada pero requiere aprobación de un administrador para acceder a la aplicación.
                </p>

                {invitaciones.length > 0 && (
                    <div style={{ textAlign: 'left', marginBottom: '25px' }}>
                        <p style={{ fontWeight: 600, marginBottom: '10px' }}>Te invitaron a un campo:</p>
                        {error && <div className="alert alert-error">{error}</div>}
                        {invitaciones.map((inv) => (
                            <div key={inv.id} className="card" style={{ background: 'var(--background)', marginBottom: '10px' }}>
                                <strong>{inv.campoNombre}</strong>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
                                    Invitado por {inv.invitedByEmail}
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    disabled={accepting !== null}
                                    onClick={() => handleAccept(inv.id)}
                                >
                                    {accepting === inv.id ? 'Aceptando...' : 'Aceptar y entrar'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="alert alert-warning" style={{ marginBottom: '25px', fontSize: '14px' }}>
                    Te notificaremos cuando tu acceso haya sido habilitado.
                </div>
                <button
                    onClick={handleLogout}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                >
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
