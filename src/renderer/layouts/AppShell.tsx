import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Sparkles,
} from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { APP_ROUTES, getRouteByPath } from '../../shared/domain/navigation';
import { StatusPill } from '../components/ui/StatusPill';
import { useOllamaStatus } from '../hooks/useOllamaStatus';
import { useUiStore } from '../app/ui-store';

const icons = [LayoutDashboard, CalendarDays, GraduationCap, ClipboardList, BarChart3, Bot];

export function AppShell() {
  const location = useLocation();
  const route = getRouteByPath(location.pathname);
  const { sidebarCollapsed, settingsLoaded, hydrate, setSidebarCollapsed } = useUiStore();
  const ollama = useOllamaStatus();

  useEffect(() => {
    void window.gateHelper.settings.get().then((settings) => hydrate(settings.sidebarCollapsed));
  }, [hydrate]);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    void window.gateHelper.settings.update({ sidebarCollapsed: next });
  };

  return (
    <div className={`app-frame${sidebarCollapsed ? ' app-frame--collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand__mark"><Sparkles size={21} /></div>
          <div className="brand__copy">
            <strong>GATE Helper</strong>
            <span>2027 preparation</span>
          </div>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__label">Workspace</p>
          {APP_ROUTES.map((item, index) => {
            const Icon = icons[index];
            return (
              <NavLink
                key={item.path}
                end={item.path === '/'}
                to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={19} />
                <span>{item.shortLabel}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          {!sidebarCollapsed && (
            <div className="local-note">
              <div><span className="local-note__dot" /> Local-first</div>
              <p>Your study data stays on this device.</p>
            </div>
          )}
          <button className="collapse-button" onClick={toggleSidebar} disabled={!settingsLoaded}>
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            <span>{sidebarCollapsed ? 'Expand' : 'Collapse sidebar'}</span>
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <Menu className="topbar__menu-icon" size={20} />
            <div>
              <strong>{route.label}</strong>
              <span>{route.description}</span>
            </div>
          </div>
          <div className="topbar__actions">
            <StatusPill status={ollama.data} loading={ollama.loading} compact />
            <div className="avatar" aria-label="Local profile">GH</div>
          </div>
        </header>
        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

