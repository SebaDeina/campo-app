import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const user = await api('/auth/me');
      setCurrentUser(user);
      return user;
    } catch (error) {
      if (error.status !== 401) throw error;
      setCurrentUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser()
      .catch((error) => console.error('No se pudo cargar la sesión:', error))
      .finally(() => setLoading(false));
  }, [refreshUser]);

  // Mientras la cuenta está pendiente, revisamos cada 30 s si ya la aprobaron.
  useEffect(() => {
    if (!currentUser || currentUser.isApproved) return undefined;
    const timer = setInterval(() => refreshUser().catch(() => {}), 30_000);
    return () => clearInterval(timer);
  }, [currentUser, refreshUser]);

  async function signup(email, password, displayName) {
    const user = await api('/auth/signup', { method: 'POST', body: { email, password, displayName } });
    setCurrentUser(user);
    return user;
  }

  async function login(email, password) {
    const user = await api('/auth/login', { method: 'POST', body: { email, password } });
    setCurrentUser(user);
    return user;
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setCurrentUser(null);
  }

  function resetPassword(email) {
    return api('/auth/reset', { method: 'POST', body: { email } });
  }

  // El login con Google lo hace el servidor: nos vamos de la página y volvemos a /app.
  function loginWithGoogle() {
    window.location.assign('/api/auth/google');
    return new Promise(() => {});
  }

  async function updateProfile(changes) {
    const user = await api('/auth/me', { method: 'PATCH', body: changes });
    setCurrentUser(user);
    return user;
  }

  const value = {
    currentUser,
    signup,
    login,
    logout,
    resetPassword,
    loginWithGoogle,
    updateProfile,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
