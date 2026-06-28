import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getUser, clearAuth } from '../lib/auth';

interface Props {
  extras?: ReactNode;
}

/** Chrome principal de las vistas de admin: logo, navegación y sesión. */
export function Sidebar({ extras }: Props) {
  const user = getUser();
  const navigate = useNavigate();

  function logout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div style={{ marginBottom: '24px' }}>
          <div className="t-20 w-600" style={{ letterSpacing: '-0.02em' }}>
            Turnia
          </div>
        </div>

        <nav className="sidebar-section">
          <NavLink to="/admin/agenda" className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
            Agenda
          </NavLink>
          <NavLink to="/admin/reportes" className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
            Reportes
          </NavLink>
        </nav>

        {extras}
      </div>

      <div className="sidebar-footer">
        <div style={{ minWidth: 0 }}>
          <div className="t-13 w-500" style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name}
          </div>
          <div className="t-12 muted">{user?.role === 'DIRECTOR' ? 'Director' : 'Administrador'}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
