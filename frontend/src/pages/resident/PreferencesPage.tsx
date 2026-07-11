import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { Preference } from "../../api/types";
import { WEEKDAY_LABELS } from "../../api/types";
import { useServices } from "../../hooks/useServices";
import { MonthPicker } from "../../components/MonthPicker";

const WEEKDAYS = [1, 2, 3, 4, 5];

const today = new Date();

export function PreferencesPage() {
  const { services } = useServices();
  const service = services[0]; // de momento solo Urgencias
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([]);
  const [avoidWeekdays, setAvoidWeekdays] = useState<number[]>([]);
  const [avoidDates, setAvoidDates] = useState<string[]>([]);
  const [newAvoidDate, setNewAvoidDate] = useState("");
  const [preferredPostId, setPreferredPostId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return;
    setLoading(true);
    setMessage(null);
    api
      .get<Preference | null>("/preferences", { params: { serviceId: service.id, year, month } })
      .then((res) => {
        const pref = res.data;
        setPreferredWeekdays(pref?.preferredWeekdays ?? []);
        setAvoidWeekdays(pref?.avoidWeekdays ?? []);
        setAvoidDates(pref?.avoidDates ?? []);
        setPreferredPostId(pref?.preferredPostId ?? "");
        setNotes(pref?.notes ?? "");
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [service, year, month]);

  function toggle(arr: number[], setArr: (v: number[]) => void, day: number) {
    setArr(arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day]);
  }

  async function handleSave() {
    if (!service) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.put("/preferences", {
        serviceId: service.id,
        year,
        month,
        preferredWeekdays,
        avoidWeekdays,
        avoidDates,
        preferredPostId: preferredPostId || null,
        notes,
      });
      setMessage("Preferencias guardadas");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!service) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-slate-800">Preferencias de guardias</h1>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando preferencias...</p>
      ) : (
        <div className="space-y-6 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <h2 className="text-sm font-medium text-slate-700 mb-2">Días de la semana preferidos</h2>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggle(preferredWeekdays, setPreferredWeekdays, d)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    preferredWeekdays.includes(d)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-700 mb-2">Días de la semana a evitar</h2>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggle(avoidWeekdays, setAvoidWeekdays, d)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    avoidWeekdays.includes(d)
                      ? "bg-red-600 text-white border-red-600"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-700 mb-2">Puerta preferida</h2>
            <select
              value={preferredPostId}
              onChange={(e) => setPreferredPostId(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sin preferencia</option>
              {service.posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-700 mb-2">
              Fechas concretas a evitar este mes (no son vacaciones, solo preferencia)
            </h2>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={newAvoidDate}
                onChange={(e) => setNewAvoidDate(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <button
                onClick={() => {
                  if (newAvoidDate && !avoidDates.includes(newAvoidDate)) {
                    setAvoidDates([...avoidDates, newAvoidDate].sort());
                    setNewAvoidDate("");
                  }
                }}
                className="px-3 py-2 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
              >
                Añadir
              </button>
            </div>
            {avoidDates.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {avoidDates.map((d) => (
                  <li
                    key={d}
                    className="flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-2 py-1 rounded-md"
                  >
                    {d}
                    <button
                      onClick={() => setAvoidDates(avoidDates.filter((x) => x !== d))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-700 mb-2">Notas (opcional)</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar preferencias"}
          </button>
        </div>
      )}
    </div>
  );
}
