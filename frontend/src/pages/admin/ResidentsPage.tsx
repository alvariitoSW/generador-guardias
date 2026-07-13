import { useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { Resident } from "../../api/types";

export function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<Resident[]>("/residents")
      .then((res) => setResidents(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateResident(id: string, data: Partial<{ monthlyQuota: number; residencyYear: number; active: boolean }>) {
    setSavingId(id);
    try {
      await api.patch(`/residents/${id}`, data);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  const pending = useMemo(() => residents.filter((r) => !r.user.active), [residents]);
  const sortedResidents = useMemo(
    () => [...residents].sort((a, b) => Number(a.user.active) - Number(b.user.active)),
    [residents]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-slate-800">Residentes</h1>
        <span className="text-sm text-slate-500">{residents.length} residentes</span>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!loading && pending.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-1">
            {pending.length} cuenta{pending.length !== 1 ? "s" : ""} pendiente{pending.length !== 1 ? "s" : ""} de activar
          </h2>
          <p className="text-xs text-amber-700 mb-3">
            Alguien se ha registrado eligiendo este nombre. Comprueba que coincide con la persona correcta antes de activarla.
          </p>
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.user.name}</p>
                  <p className="text-xs text-slate-500">{r.user.email}</p>
                </div>
                <button
                  disabled={savingId === r.id}
                  onClick={() => updateResident(r.id, { active: true })}
                  className="text-xs font-medium bg-amber-500 text-white px-3 py-1.5 rounded-md hover:bg-amber-600 disabled:opacity-50"
                >
                  Activar cuenta
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Año</th>
                <th className="px-4 py-2 font-medium">Guardias/mes</th>
                <th className="px-4 py-2 font-medium">Activo</th>
              </tr>
            </thead>
            <tbody>
              {sortedResidents.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{r.user.name}</td>
                  <td className="px-4 py-2 text-slate-500">{r.user.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={r.residencyYear ?? ""}
                      disabled={savingId === r.id}
                      onChange={(e) => updateResident(r.id, { residencyYear: Number(e.target.value) })}
                      className="border border-slate-300 rounded-md px-2 py-1"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((y) => (
                        <option key={y} value={y}>
                          R{y}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={r.monthlyQuota}
                      disabled={savingId === r.id}
                      onChange={(e) => updateResident(r.id, { monthlyQuota: Number(e.target.value) })}
                      className="w-16 border border-slate-300 rounded-md px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      disabled={savingId === r.id}
                      onClick={() => updateResident(r.id, { active: !r.user.active })}
                      className={`px-2 py-1 rounded-md text-xs font-medium ${
                        r.user.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.user.active ? "Activo" : "Pendiente"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
