import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../firebase/AuthContext';
import { useCampo } from '../firebase/CampoContext';
import { LogOut, Settings, Map, Menu, X, Droplets, CalendarCheck, CloudSun, UserPlus, ListChecks } from 'lucide-react';
import logo from '../img/icons8-grass-50.png';

const NAV_LINKS = [
  { to: '/app', label: 'Dashboard' },
  { to: '/app/ovejas', label: 'Ovejas' },
  { to: '/app/clima', label: 'Clima' },
  { to: '/app/lluvias', label: 'Lluvias' },
  { to: '/app/tareas', label: 'Tareas' },
];

export default function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopUserOpen, setDesktopUserOpen] = useState(false);
  const [campoModalOpen, setCampoModalOpen] = useState(false);
  const userMenuRef = useRef(null);
  const quickActions = [
    {
      key: 'lluvias',
      label: 'Registrar lluvia',
      icon: Droplets,
      onClick: () => navigate('/app/lluvias')
    },
    {
      key: 'tareas',
      label: 'Nueva tarea',
      icon: CalendarCheck,
      onClick: () => navigate('/app/tareas')
    },
    {
      key: 'ovejas',
      label: 'Gestionar ovejas',
      icon: ListChecks,
      onClick: () => navigate('/app/ovejas')
    },
    {
      key: 'clima',
      label: 'Ver clima',
      icon: CloudSun,
      onClick: () => navigate('/app/clima')
    },
    {
      key: 'equipo',
      label: 'Invitar miembro',
      icon: UserPlus,
      onClick: () => navigate('/app/configuracion#equipo')
    }
  ];
  let campos = [];
  let selectedCampoId = null;
  let selectCampo = () => {};
  let loadingCampos = false;

  if (typeof useCampo === 'function') {
    const campoContext = useCampo();
    if (campoContext) {
      campos = campoContext.campos || [];
      selectedCampoId = campoContext.selectedCampoId || null;
      selectCampo = campoContext.selectCampo || (() => {});
      loadingCampos = campoContext.loadingCampos || false;
    }
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setDesktopUserOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  const avatarLetter = currentUser?.displayName?.[0] || currentUser?.email?.[0] || 'U';
  const avatarPhoto =
    currentUser?.photoURL ||
    currentUser?.providerData?.find((provider) => provider.photoURL)?.photoURL ||
    null;

  function renderLink(item, variant) {
    const isActive = location.pathname === item.to;
    const base =
      variant === 'desktop'
        ? 'rounded-md px-3 py-2 text-sm font-medium transition-colors'
        : 'rounded-md px-3 py-2 text-base font-medium';
    const active = 'bg-[var(--primary)] text-white shadow-sm';
    const inactive =
      variant === 'desktop'
        ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        : 'text-gray-700 hover:bg-gray-100';

    return (
      <Link key={`${variant}-${item.to}`} to={item.to} className={`${base} ${isActive ? active : inactive}`}>
        {item.label}
      </Link>
    );
  }

  function renderCampoBadge(variant = 'desktop') {
    if (loadingCampos) {
      return <p className="text-xs text-gray-500">Cargando campos...</p>;
    }

    if (!campos.length) {
      return (
        <button
          onClick={() => navigate('/app/configuracion')}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--primary-dark)]"
        >
          Crear mi campo
        </button>
      );
    }

    const currentCampo = campos.find((campo) => campo.id === selectedCampoId) || campos[0];
    const layoutClasses =
      variant === 'desktop'
        ? 'flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-left shadow-sm'
        : 'flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left shadow-sm w-full';

    return (
      <button className={layoutClasses} onClick={() => setCampoModalOpen(true)}>
        <div className="flex items-center gap-1">
          <div className="rounded-full bg-[var(--primary)]/10 p-1.5 text-[var(--primary)]">
            <Map size={16} />
          </div>
          <div style={{ fontWeight: 600 }}>{currentCampo?.nombre || 'Seleccionar'}</div>
        </div>
      </button>
    );
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-3"
            onClick={() => navigate('/app')}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)]/10">
              <img src={logo} alt="Campo App" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">Nimbo</p>
              <p className="text-xs text-gray-500">Gestión Agropecuaria Inteligente</p>
            </div>
          </button>

          <div className="hidden flex-1 items-center justify-center gap-4 md:flex">
            {renderCampoBadge('desktop')}
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map((item) => renderLink(item, 'desktop'))}
            </nav>
          </div>

          <div className="hidden items-center gap-5 md:flex">
            {currentUser && (
              <div className="relative" ref={userMenuRef}>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  onClick={() => setDesktopUserOpen((prev) => !prev)}
                  aria-label="Abrir menú de usuario"
                >
                  {avatarPhoto ? (
                    <img src={avatarPhoto} alt="Avatar del usuario" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-base font-semibold text-gray-700">
                      {avatarLetter.toUpperCase()}
                    </span>
                  )}
                </button>

                {desktopUserOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white p-3 text-sm text-gray-700 shadow-lg ring-1 ring-black/5 z-50">
                    <div className="mb-3 border-b border-gray-100 pb-3">
                      <p className="font-semibold">{currentUser.displayName || 'Mi cuenta'}</p>
                      <p className="text-xs text-gray-500">{currentUser.email}</p>
                    </div>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 hover:bg-gray-100"
                      onClick={() => {
                        navigate('/app/configuracion');
                        setDesktopUserOpen(false);
                      }}
                    >
                      <Settings size={16} /> Configuración general
                    </button>
                    <button
                      className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-red-600 hover:bg-red-50"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {currentUser && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                {avatarPhoto ? (
                  <img src={avatarPhoto} alt="Avatar del usuario" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="text-base font-semibold text-gray-700">
                    {avatarLetter.toUpperCase()}
                  </span>
                )}
              </div>
            )}
            <button
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <div className="hidden md:mt-3 md:flex md:w-full md:justify-center">
          <div className="mx-auto flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 px-2 py-1 shadow-sm backdrop-blur">
            {quickActions.map((action) => (
              <button
                key={action.key}
                onClick={action.onClick}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-white hover:text-gray-900"
                type="button"
              >
                <action.icon size={16} className="text-[var(--primary)]" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:hidden">
            {renderCampoBadge('mobile')}
            
            <div className="flex flex-col gap-2">{NAV_LINKS.map((item) => renderLink(item, 'mobile'))}</div>

            {currentUser && (
              <div className="mt-2 border-t border-gray-200 pt-3 text-sm text-gray-700">
                <p className="font-semibold">{currentUser.displayName || currentUser.email}</p>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    className="rounded-md bg-white px-3 py-2 text-left font-medium hover:bg-gray-100"
                    onClick={() => {
                      navigate('/app/configuracion');
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Settings size={16} /> Perfil y configuración
                    </span>
                  </button>
                  
                  <button
                    className="rounded-md bg-red-50 px-3 py-2 text-left font-medium text-red-600 hover:bg-red-100"
                    onClick={handleLogout}
                  >
                    <span className="flex items-center gap-2">
                      <LogOut size={16} /> Cerrar sesión
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!mobileMenuOpen && (
          <div className="mt-3 w-full overflow-x-auto pb-3 md:hidden">
            <div className="flex w-max gap-2 pr-4">
              {quickActions.map((action) => (
                <button
                  key={`mobile-${action.key}`}
                  onClick={action.onClick}
                  className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm whitespace-nowrap"
                  type="button"
                >
                  <action.icon size={16} className="text-[var(--primary)]" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {campoModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Cambiar de proyecto:</h2>
              <button className="close-btn" onClick={() => setCampoModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            {loadingCampos ? (
              <p style={{ color: 'var(--text-secondary)' }}>Cargando campos...</p>
            ) : campos.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                Aún no tienes campos. Crea uno desde Configuración.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {campos.map((campo) => (
                  <button
                    key={campo.id}
                    className="btn"
                    style={{
                      justifyContent: 'flex-start',
                      border: campo.id === selectedCampoId ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: campo.id === selectedCampoId ? 'rgba(46,125,50,0.1)' : 'white'
                    }}
                    onClick={() => {
                      selectCampo(campo.id);
                      setCampoModalOpen(false);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <div>
                      <strong>{campo.nombre}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Rol: {campo.miembros?.[currentUser?.uid || '']?.rol || '—'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
