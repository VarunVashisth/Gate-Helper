import { NavLink, Outlet } from "react-router-dom";
import { Icon } from "./Icon";
import { usePlatform } from "../context/PlatformContext";

const navigation = [
  { to: "/", label: "Dashboard", icon: "dashboard" as const, end: true },
  { to: "/syllabus", label: "Syllabus", icon: "syllabus" as const },
  { to: "/tests", label: "Tests", icon: "tests" as const },
  { to: "/results", label: "Results", icon: "results" as const },
  { to: "/ai-tutor", label: "AI Tutor", icon: "tutor" as const },
];

export function Layout() {
  const platform = usePlatform();
  const mode = platform.status === "ready" ? platform.info.mode : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="spark" size={23} /></div>
          <div><strong>GATE</strong><span>2027 HELPER</span></div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <Icon name={item.icon} /><span>{item.label}</span>
              {item.to === "/ai-tutor" && mode === "desktop" && <i className="status-dot" title="Desktop feature" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`mode-indicator ${mode ?? "loading"}`} />
          <div><small>RUNNING IN</small><strong>{mode ? `${mode} mode` : "Connecting…"}</strong></div>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}

