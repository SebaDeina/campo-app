import { useEffect, useState } from 'react';
import { useAuth } from '../firebase/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [resetFeedback, setResetFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const location = useLocation();
  const initialMode = location.state?.mode === 'signup';
  const [isSignup, setIsSignup] = useState(initialMode);

  const { login, signup, resetPassword, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // El servidor vuelve a /login?error=google si el login con Google falló.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('error') === 'google') {
      setError('No pudimos iniciar sesión con Google. Intenta nuevamente.');
    }
  }, [location.search]);

  useEffect(() => {
    if (location.state?.mode) {
      setIsSignup(location.state.mode === 'signup');
    }
  }, [location.state]);

  useEffect(() => {
    setError('');
    setResetFeedback('');
    if (!isSignup) {
      setDisplayName('');
      setConfirmPassword('');
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
        if (password !== confirmPassword) {
          setError('Las contraseñas deben coincidir');
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
      if (error.code === 'auth/invalid-credential') {
        setError('Email o contraseña incorrectos');
      } else if (error.code === 'auth/user-disabled') {
        setError('Tu cuenta está deshabilitada');
      } else if (error.code === 'auth/invalid-email') {
        setError('El email no es válido');
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

  async function handleResetPassword() {
    if (!email) {
      setError('Ingresá tu email para poder enviarte el enlace de recuperación');
      return;
    }
    try {
      setError('');
      await resetPassword(email);
      setResetFeedback('Si hay una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.');
    } catch (err) {
      console.error(err);
      setError('No pudimos enviar el correo. Intenta más tarde.');
    }
  }

  async function handleGoogleLogin() {
    try {
      setError('');
      setResetFeedback('');
      setGoogleLoading(true);
      await loginWithGoogle();
      navigate('/app');
    } catch (err) {
      console.error(err);
      setError('No pudimos iniciar sesión con Google. Intenta nuevamente.');
    } finally {
      setGoogleLoading(false);
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
        {resetFeedback && <div className="alert alert-success">{resetFeedback}</div>}

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

          {isSignup && (
            <div className="input-group">
              <label>Repetir contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirma tu contraseña"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || googleLoading}
            style={{ width: '100%' }}
          >
            {loading ? 'Cargando...' : (isSignup ? 'Crear Cuenta' : 'Ingresar')}
          </button>
        </form>

        {!isSignup && (
          <>
            <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>o</span>
              <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', background: '#fff', color: '#000', border: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              {!googleLoading && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.20443C17.64 8.56625 17.5827 7.95262 17.4764 7.36353H9V10.8449H13.8436C13.635 11.9699 13.0009 12.9231 12.0477 13.5613V15.8194H14.9564C16.6582 14.2526 17.64 11.9453 17.64 9.20443Z" fill="#4285F4" />
                  <path d="M8.99976 18C11.4298 18 13.467 17.1941 14.9561 15.8195L12.0475 13.5613C11.2416 14.1013 10.2107 14.4204 8.99976 14.4204C6.65567 14.4204 4.67158 12.8372 3.96385 10.71H0.957031V13.0418C2.43794 15.9831 5.48158 18 8.99976 18Z" fill="#34A853" />
                  <path d="M3.96409 10.7098C3.78409 10.1698 3.68182 9.59301 3.68182 8.99983C3.68182 8.40665 3.78409 7.82983 3.96409 7.28983V4.95801H0.957273C0.347727 6.17301 0 7.54755 0 8.99983C0 10.4521 0.347727 11.8266 0.957273 13.0416L3.96409 10.7098Z" fill="#FBBC05" />
                  <path d="M8.99976 3.57955C10.3211 3.57955 11.5075 4.03364 12.4402 4.92545L15.0216 2.34409C13.4629 0.891818 11.4257 0 8.99976 0C5.48158 0 2.43794 2.01682 0.957031 4.95818L3.96385 7.29C4.67158 5.16273 6.65567 3.57955 8.99976 3.57955Z" fill="#EA4335" />
                </svg>
              )}
              {googleLoading ? 'Conectando...' : 'Continuar con Google'}
            </button>
          </>
        )}
        {!isSignup && (
          <div style={{ marginTop: '15px' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                padding: 0,
                fontWeight: 600,
                textDecoration: 'underline'
              }}
              onClick={handleResetPassword}
            >
              Olvidé mi contraseña
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '15px', color: 'var(--text-secondary)' }}>
          {isSignup ? '¿Ya tienes cuenta?' : '¿Primera vez usando Nimbo?'}{' '}
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
