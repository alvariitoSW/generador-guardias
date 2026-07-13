import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { Preference } from "../../api/types";
import { WEEKDAY_LABELS } from "../../api/types";
import { useServices } from "../../hooks/useServices";
import { useMyResident } from "../../hooks/useMyResident";
import { MonthPicker } from "../../components/MonthPicker";

const WEEKDAYS = [1, 2, 3, 4, 5];
const MAX_PREFERRED_DATES = 3;

const today = new Date();

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month, 0).getDate();
  return { min: `${year}-${pad(month)}-01`, max: `${year}-${pad(month)}-${pad(last)}` };
}

export function PreferencesPage() {
  const { services } = useServices();
  const { resident } = useMyResident();
  const service = services[0]; // de momento solo Urgencias
  const monthlyQuota = resident?.monthlyQuota ?? 4;
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [hasReducedQuota, setHasReducedQuota] = useState(false);
  const [reducedQuota, setReducedQuota] = useState(0);
  const [reducedQuotaReason, setReducedQuotaReason] = useState("");
  const [preferredDates, setPreferredDates] = useState<string[]>([]);
  const [newPreferredDate, setNewPreferredDate] = useState("");
  const [avoidWeekdays, setAvoidWeekdays] = useState<number[]>([]);
  const [avoidDates, setAvoidDates] = useState<string[]>([]);
  const [newAvoidDate, setNewAvoidDate] = useState("");
  const [outgoingFirstDay, setOutgoingFirstDay] = useState(false);
  const [hasOtherServiceGuardias, setHasOtherServiceGuardias] = useState(false);
  const [otherServiceGuardiaDates, setOtherServiceGuardiaDates] = useState<string[]>([]);
  const [newOtherServiceDate, setNewOtherServiceDate] = useState("");
  const [preferredPostId, setPreferredPostId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { min: monthMin, max: monthMax } = monthRange(year, month);

  useEffect(() => {
    if (!service) return;
    setLoading(true);
    setMessage(null);
    api
      .get<Preference | null>("/preferences", { params: { serviceId: service.id, year, month } })
      .then((res) => {
        const pref = res.data;
        setHasReducedQuota(pref?.reducedQuota != null);
        setReducedQuota(pref?.reducedQuota ?? Math.max(0, monthlyQuota - 1));
        setReducedQuotaReason(pref?.reducedQuotaReason ?? "");
        setPreferredDates(pref?.preferredDates ?? []);
        setAvoidWeekdays(pref?.avoidWeekdays ?? []);
        setAvoidDates(pref?.avoidDates ?? []);
        setOutgoingFirstDay(pref?.outgoingFirstDay ?? false);
        setHasOtherServiceGuardias(pref?.hasOtherServiceGuardias ?? false);
        setOtherServiceGuardiaDates(pref?.otherServiceGuardiaDates ?? []);
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
        reducedQuota: hasReducedQuota ? reducedQuota : null,
        reducedQuotaReason: hasReducedQuota ? reducedQuotaReason : undefined,
        preferredDates,
        avoidWeekdays,
        avoidDates,
        outgoingFirstDay,
        hasOtherServiceGuardias,
        otherServiceGuardiaDates: hasOtherServiceGuardias ? otherServiceGuardiaDates : [],
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
          <div className="border border-slate-200 rounded-md p-3">
            <p className="text-sm text-slate-700 mb-2">
              Tu objetivo este mes es <span className="font-semibold">{monthlyQuota} guardias</span>. Si vas a hacer
              menos, indícalo aquí.
            </p>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="has-reduced-quota"
                checked={hasReducedQuota}
                onChange={(e) => setHasReducedQuota(e.target.checked)}
                className="mt-0.5"
              />
              <label htmlFor="has-reduced-quota" className="text-sm text-slate-700">
                Este mes voy a hacer menos de {monthlyQuota} guardias
              </label>
            </div>
            {hasReducedQuota && (
              <div className="mt-3 pl-7 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">¿Cuántas?</label>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, monthlyQuota - 1)}
                    value={reducedQuota}
                    onChange={(e) => setReducedQuota(Number(e.target.value))}
                    className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={reducedQuotaReason}
                  onChange={(e) => setReducedQuotaReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-3">
            <input
              type="checkbox"
              id="outgoing-first-day"
              checked={outgoingFirstDay}
              onChange={(e) => setOutgoingFirstDay(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="outgoing-first-day" className="text-sm text-amber-900">
              <span className="font-medium">Salgo de guardia el día 1 de este mes</span>
              <br />
              <span className="text-amber-700">
                Si el último día del mes anterior tienes guardia, márcalo para que no se te asigne guardia el día 1.
              </span>
            </label>
          </div>

          <div className="border border-slate-200 rounded-md p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="has-other-service"
                checked={hasOtherServiceGuardias}
                onChange={(e) => setHasOtherServiceGuardias(e.target.checked)}
                className="mt-0.5"
              />
              <label htmlFor="has-other-service" className="text-sm text-slate-700">
                <span className="font-medium">Tengo guardias de mi servicio (aparte de Urgencias) este mes</span>
                <br />
                <span className="text-slate-500">
                  Si tu especialidad también te pone de guardia, marca los días para que no se te asigne Urgencias
                  esos días ni el siguiente (por el descanso post-guardia).
                </span>
              </label>
            </div>

            {hasOtherServiceGuardias && (
              <div className="mt-3 pl-7">
                <div className="flex gap-2 mb-2">
                  <input
                    type="date"
                    value={newOtherServiceDate}
                    min={monthMin}
                    max={monthMax}
                    onChange={(e) => setNewOtherServiceDate(e.target.value)}
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (newOtherServiceDate && !otherServiceGuardiaDates.includes(newOtherServiceDate)) {
                        setOtherServiceGuardiaDates([...otherServiceGuardiaDates, newOtherServiceDate].sort());
                        setNewOtherServiceDate("");
                      }
                    }}
                    className="px-3 py-2 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Añadir
                  </button>
                </div>
                {otherServiceGuardiaDates.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {otherServiceGuardiaDates.map((d) => (
                      <li
                        key={d}
                        className="flex items-center gap-1 bg-amber-50 text-amber-700 text-sm px-2 py-1 rounded-md"
                      >
                        {d}
                        <button
                          onClick={() => setOtherServiceGuardiaDates(otherServiceGuardiaDates.filter((x) => x !== d))}
                          className="text-amber-500 hover:text-red-600"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-700 mb-2">
              Días del mes preferidos (máximo {MAX_PREFERRED_DATES})
            </h2>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={newPreferredDate}
                min={monthMin}
                max={monthMax}
                onChange={(e) => setNewPreferredDate(e.target.value)}
                disabled={preferredDates.length >= MAX_PREFERRED_DATES}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (
                    newPreferredDate &&
                    !preferredDates.includes(newPreferredDate) &&
                    preferredDates.length < MAX_PREFERRED_DATES
                  ) {
                    setPreferredDates([...preferredDates, newPreferredDate].sort());
                    setNewPreferredDate("");
                  }
                }}
                disabled={preferredDates.length >= MAX_PREFERRED_DATES}
                className="px-3 py-2 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
            {preferredDates.length >= MAX_PREFERRED_DATES && (
              <p className="text-xs text-slate-500 mb-2">
                Ya has elegido el máximo de {MAX_PREFERRED_DATES} días. Quita alguno para cambiarlo.
              </p>
            )}
            {preferredDates.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {preferredDates.map((d) => (
                  <li
                    key={d}
                    className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-sm px-2 py-1 rounded-md"
                  >
                    {d}
                    <button
                      onClick={() => setPreferredDates(preferredDates.filter((x) => x !== d))}
                      className="text-emerald-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
                min={monthMin}
                max={monthMax}
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
