import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './firebase/AuthContext';
import { CampoProvider, useCampo } from './firebase/CampoContext';
import Header from './components/Header';
import CampoOnboarding from './components/CampoOnboarding';
import Login from './components/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Ovejas from './pages/Ovejas';
import Clima from './pages/Clima';
import Lluvias from './pages/Lluvias';
import Tareas from './pages/Tareas';
import Configuracion from './pages/Configuracion';
import PendingApproval from './pages/PendingApproval';
import './styles/App.css';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (currentUser.isApproved === false) {
    return <Navigate to="/pending-approval" />;
  }

  return children;
}

import { Outlet } from 'react-router-dom';

function CampoLayout() {
  const {
    campos,
    loadingCampos,
    invitaciones,
    loadingInvitaciones,
    acceptInvite,
    rejectInvite
  } = useCampo();

  if (loadingCampos) {
    return (
      <div className="container">
        <div className="loading">Cargando campos...</div>
      </div>
    );
  }

  if (!campos.length) {
    return <CampoOnboarding />;
  }

  return (
    <>
      {!loadingInvitaciones && invitaciones.length > 0 && (
        <div className="container" style={{ marginTop: '20px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '10px' }}>Invitaciones pendientes</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Acepta para acceder al campo que te compartieron.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {invitaciones.map((inv) => (
                <div key={inv.id} className="card" style={{ background: 'var(--background)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{inv.campoNombre}</strong>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Rol: {inv.rol || 'editor'} · Invitado por {inv.invitedByEmail}
                      </div>
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
          </div>
        </div>
      )}

      <Header />
      <Outlet />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <CampoProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pending-approval" element={
              <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
                <PendingApproval />
              </div>
            } />
            <Route
              path="/app"
              element={
                <PrivateRoute>
                  <CampoLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="ovejas" element={<Ovejas />} />
              <Route path="clima" element={<Clima />} />
              <Route path="lluvias" element={<Lluvias />} />
              <Route path="tareas" element={<Tareas />} />
              <Route path="configuracion" element={<Configuracion />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </CampoProvider>
    </AuthProvider>
  );
}

export default App;
