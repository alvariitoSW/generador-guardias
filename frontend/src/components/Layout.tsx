import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  const menuLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 text-sm rounded-md ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`;

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
            {user?.role === "ADMIN" ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  className="text-sm text-slate-600 px-2 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1"
                >
                  {user?.name}
                  <span className="text-xs text-slate-400">▾</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-10">
                    <NavLink to="/admin/cuenta" className={menuLinkClass} onClick={() => setMenuOpen(false)}>
                      Mi cuenta
                    </NavLink>
                    <NavLink to="/admin/residentes" className={menuLinkClass} onClick={() => setMenuOpen(false)}>
                      Administradores
                    </NavLink>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-500">{user?.name}</span>
            )}
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
