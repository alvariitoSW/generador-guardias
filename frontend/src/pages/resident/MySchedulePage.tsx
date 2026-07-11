import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { ScheduleMonth } from "../../api/types";
import { useServices } from "../../hooks/useServices";
import { useMyResident } from "../../hooks/useMyResident";
import { MonthPicker } from "../../components/MonthPicker";

const today = new Date();

const WEEKDAY_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function MySchedulePage() {
  const { services } = useServices();
  const { resident } = useMyResident();
  const service = services[0];
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedule, setSchedule] = useState<ScheduleMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return;
    setLoading(true);
    setError(null);
    api
      .get<ScheduleMonth | null>("/schedule", { params: { serviceId: service.id, year, month } })
      .then((res) => setSchedule(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [service, year, month]);

  const myAssignments =
    schedule?.assignments.filter((a) => a.residentId === resident?.id).sort((a, b) => a.date.localeCompare(b.date)) ?? [];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-slate-800">Mi cuadrante</h1>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {loading && <p className="text-slate-500">Cargando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && !schedule && (
        <p className="text-slate-500">El cuadrante de este mes todavía no se ha publicado.</p>
      )}

      {!loading && schedule && myAssignments.length === 0 && (
        <p className="text-slate-500">No tienes guardias asignadas este mes.</p>
      )}

      {!loading && myAssignments.length > 0 && (
        <ul className="space-y-2">
          {myAssignments.map((a) => {
            const date = new Date(`${a.date.slice(0, 10)}T00:00:00`);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
              >
                <span className="text-sm text-slate-800">
                  {WEEKDAY_FULL[date.getDay()]} {date.toLocaleDateString("es-ES")}
                </span>
                <span className="text-sm font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
                  {a.post.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && myAssignments.length > 0 && (
        <p className="text-sm text-slate-500 mt-4">
          Total: {myAssignments.length} guardia{myAssignments.length !== 1 ? "s" : ""} este mes
        </p>
      )}
    </div>
  );
}
