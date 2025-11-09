import { useEffect, useState } from 'react';
import { useAuth } from '../firebase/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const initialMode = location.state?.mode === 'signup';
  const [isSignup, setIsSignup] = useState(initialMode);
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.mode) {
      setIsSignup(location.state.mode === 'signup');
    }
  }, [location.state]);

  useEffect(() => {
    setError('');
    if (!isSignup) {
      setDisplayName('');
    }
  }, [isSignup]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      
      if (isSignup) {
        const trimmedName = displayName.trim();
        if (!trimmedName) {
          setError('Necesitamos tu nombre para crear la cuenta');
          setLoading(false);
          return;
        }
        await signup(email, password, trimmedName);
      } else {
        await login(email, password);
      }
      
      navigate('/app');
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/user-not-found') {
        setError('Usuario no encontrado');
      } else if (error.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('El email ya está registrado');
      } else if (error.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else {
        setError('Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
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
      <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '30px' }}>
        <div style={{ marginBottom: '15px' }}>
          <Link
            to="/"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '14px'
            }}
          >
            ← Volver al inicio
          </Link>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '5px', color: 'var(--primary)' }}>
          {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '25px' }}>
          {isSignup ? 'Configura tu usuario y crea tu primer campo.' : 'Accede a tus campos y equipo.'}
        </p>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isSignup && (
            <div className="input-group">
              <label>Nombre</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Ej. Juan Pérez"
              />
            </div>
          )}

          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
            />
          </div>
          
          <div className="input-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Cargando...' : (isSignup ? 'Crear Cuenta' : 'Ingresar')}
          </button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '15px', color: 'var(--text-secondary)' }}>
          {isSignup ? '¿Ya tienes cuenta?' : '¿Primera vez usando Campo App?'}{' '}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--primary)', 
              cursor: 'pointer',
              padding: 0,
              fontWeight: 600
            }}
          >
            {isSignup ? 'Inicia sesión' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </div>
  );
}
