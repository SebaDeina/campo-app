import { useAuth } from '../firebase/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function PendingApproval() {
    const { logout, currentUser } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
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
