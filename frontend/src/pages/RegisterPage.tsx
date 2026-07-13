import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, apiErrorMessage } from "../api/client";
import type { RosterName } from "../api/types";

export function RegisterPage() {
  const { register } = useAuth();
  const [roster, setRoster] = useState<RosterName[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterNameId, setRosterNameId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [residencyYear, setResidencyYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RosterName[]>("/roster/available")
      .then((res) => setRoster(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingRoster(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const message = await register(email, password, rosterNameId, residencyYear ? Number(residencyYear) : undefined);
      setPendingMessage(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <div className="mx-auto mb-4 w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
            ⏳
          </div>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">Registro recibido</h1>
          <p className="text-sm text-slate-500 mb-6">{pendingMessage}</p>
          <Link to="/login" className="text-indigo-600 font-medium text-sm">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Crear cuenta</h1>
        <p className="text-sm text-slate-500 mb-6">
          Elige tu nombre de la lista de residentes. Un administrador activará tu cuenta después.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">¿Quién eres?</label>
            <select
              required
              value={rosterNameId}
              onChange={(e) => setRosterNameId(e.target.value)}
              disabled={loadingRoster}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">{loadingRoster ? "Cargando..." : "Selecciona tu nombre"}</option>
              {roster.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
            {!loadingRoster && roster.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No queda ningún nombre libre en la lista. Si es un error, avisa al administrador.
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              ¿No te encuentras en la lista o no eres tú? Contacta con el administrador.
            </p>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Año de residencia (opcional)</label>
            <select
              value={residencyYear}
              onChange={(e) => setResidencyYear(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  R{y}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || loadingRoster || roster.length === 0}
            className="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Crear cuenta"}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4 text-center">
          ¿Ya tienes cuenta? <Link to="/login" className="text-indigo-600 font-medium">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
