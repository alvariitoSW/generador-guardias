import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { Vacation } from "../../api/types";

export function VacationsPage() {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Vacation[]>("/vacations")
      .then((res) => setVacations(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/vacations", { startDate, endDate, reason: reason || undefined });
      setStartDate("");
      setEndDate("");
      setReason("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/vacations/${id}`);
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-800 mb-6">Vacaciones y ausencias</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1">Desde</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1">Hasta</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Motivo (opcional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Vacaciones, curso, etc."
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          Añadir
        </button>
      </form>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : vacations.length === 0 ? (
        <p className="text-slate-500">No tienes vacaciones registradas.</p>
      ) : (
        <ul className="space-y-2">
          {vacations.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {v.startDate.slice(0, 10)} → {v.endDate.slice(0, 10)}
                </p>
                {v.reason && <p className="text-xs text-slate-500">{v.reason}</p>}
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
