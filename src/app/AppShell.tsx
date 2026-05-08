import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>BoardBI</h1>
        <nav>
          <NavLink to="/connections">Connections</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
