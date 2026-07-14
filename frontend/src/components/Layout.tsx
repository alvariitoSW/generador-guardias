import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-800">Guardias Residentes</span>
            <nav className="flex gap-1">
              {user?.role === "RESIDENT" && (
                <>
                  <NavLink to="/mi-cuadrante" className={linkClass}>
                    Mi cuadrante
                  </NavLink>
                  <NavLink to="/preferencias" className={linkClass}>
                    Preferencias
                  </NavLink>
                  <NavLink to="/vacaciones" className={linkClass}>
                    Vacaciones
                  </NavLink>
                  <NavLink to="/cambios" className={linkClass}>
                    Cambios
                  </NavLink>
                </>
              )}
              {user?.role === "ADMIN" && (
                <>
                  <NavLink to="/admin/cuadrante" className={linkClass}>
                    Cuadrante
                  </NavLink>
                  <NavLink to="/admin/residentes" className={linkClass}>
                    Residentes
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user?.name}</span>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
