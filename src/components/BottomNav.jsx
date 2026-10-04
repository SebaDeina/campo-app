import { NavLink } from 'react-router-dom';
import { Home, PawPrint, Wheat, Droplets, CalendarCheck } from 'lucide-react';

const TABS = [
  { to: '/app', label: 'Inicio', icon: Home, end: true },
  { to: '/app/ovejas', label: 'Ovejas', icon: PawPrint },
  { to: '/app/alimento', label: 'Alimento', icon: Wheat },
  { to: '/app/lluvias', label: 'Lluvias', icon: Droplets },
  { to: '/app/tareas', label: 'Tareas', icon: CalendarCheck },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
