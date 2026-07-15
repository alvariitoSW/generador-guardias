import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api, apiErrorMessage } from "../../api/client";
import type { Resident, ScheduleMonth, ShiftAssignment } from "../../api/types";
import { useServices } from "../../hooks/useServices";
import { useAuth } from "../../context/AuthContext";
import { MonthPicker } from "../../components/MonthPicker";
import { getScheduleDaysISO, formatDayLabel } from "../../utils/dates";

const today = new Date();

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function ScheduleAdminPage() {
  const { user } = useAuth();
  const { services } = useServices();
  const service = services[0];
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [schedule, setSchedule] = useState<ScheduleMonth | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unfilledCount, setUnfilledCount] = useState(0);

  function loadSchedule() {
    if (!service) return;
    setLoading(true);
    setError(null);
    api
      .get<ScheduleMonth | null>("/schedule", { params: { serviceId: service.id, year, month } })
      .then((res) => setSchedule(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(loadSchedule, [service, year, month]);

  useEffect(() => {
    api.get<Resident[]>("/residents").then((res) => setResidents(res.data));
  }, []);

  const scheduleDays = useMemo(() => (service ? getScheduleDaysISO(year, month) : []), [service, year, month]);

  const assignmentsByKey = useMemo(() => {
    const map = new Map<string, ShiftAssignment[]>();
    for (const a of schedule?.assignments ?? []) {
      const key = `${a.date.slice(0, 10)}|${a.postId}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [schedule]);

  const activeResidents = useMemo(() => residents.filter((r) => r.user.active !== false), [residents]);

  const myApproval = useMemo(
    () => schedule?.approvalStatus?.admins.find((a) => a.id === user?.id) ?? null,
    [schedule, user]
  );

  async function handleGenerate() {
    if (!service) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post("/schedule/generate", { serviceId: service.id, year, month });
      setUnfilledCount(data.unfilledSlots?.length ?? 0);
      setNotice(
        data.unfilledSlots?.length
          ? `Cuadrante generado. ${data.unfilledSlots.length} huecos no se han podido cubrir automáticamente, revísalos abajo.`
          : "Cuadrante generado correctamente, todos los huecos cubiertos."
      );
      loadSchedule();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!schedule) return;
    setApproving(true);
    setError(null);
    try {
      await api.post(`/schedule/${schedule.id}/approve`);
      loadSchedule();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  async function handleUnapprove() {
    if (!schedule) return;
    setApproving(true);
    setError(null);
    try {
      await api.delete(`/schedule/${schedule.id}/approve`);
      loadSchedule();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  async function handleAssignChange(date: string, postId: string, existing: ShiftAssignment | undefined, residentId: string) {
    setError(null);
    try {
      if (!residentId) {
        if (existing) await api.delete(`/schedule/assignments/${existing.id}`);
      } else if (existing) {
        await api.patch(`/schedule/assignments/${existing.id}`, { residentId });
      } else if (schedule) {
        await api.post("/schedule/assignments", { scheduleMonthId: schedule.id, postId, residentId, date });
      }
      loadSchedule();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function handleDownloadPdf() {
    if (!schedule) return;
    const doc = new jsPDF({ orientation: "landscape" });
    const title = `Cuadrante de guardias — ${service.name} — ${MONTH_NAMES[month - 1]} ${year}`;
    doc.setFontSize(14);
    doc.text(title, 14, 14);

    const head = [["Día", ...service.posts.map((p) => p.name)]];
    const body = scheduleDays.map((date) => [
      formatDayLabel(date),
      ...service.posts.map((post) => {
        const assigned = assignmentsByKey.get(`${date}|${post.id}`) ?? [];
        const names = Array.from({ length: post.slotsPerDay }).map((_, i) => assigned[i]?.resident.user.name ?? "—");
        return names.join("\n");
      }),
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 20,
      styles: { fontSize: 9, cellPadding: 2, valign: "middle" },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`cuadrante-${service.name.toLowerCase()}-${year}-${String(month).padStart(2, "0")}.pdf`);
  }

  if (!service) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-slate-800">Cuadrante — {service.name}</h1>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? "Generando..." : schedule ? "Regenerar cuadrante" : "Generar cuadrante"}
        </button>
        {schedule && schedule.status === "DRAFT" && myApproval && (
          myApproval.approved ? (
            <button
              onClick={handleUnapprove}
              disabled={approving}
              className="bg-white border border-emerald-300 text-emerald-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50"
            >
              {approving ? "..." : "Quitar mi validación"}
            </button>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="bg-emerald-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {approving ? "Validando..." : "Validar cuadrante"}
            </button>
          )
        )}
        {schedule && (
          <button
            onClick={handleDownloadPdf}
            className="bg-white border border-slate-300 text-slate-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Descargar PDF
          </button>
        )}
        {schedule && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-md ${
              schedule.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {schedule.status === "PUBLISHED" ? "Publicado" : "Borrador"}
          </span>
        )}
      </div>

      {schedule?.approvalStatus && schedule.status === "DRAFT" && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-1">
            Validación pendiente — este cuadrante no será visible para los residentes hasta que todos los
            administradores lo validen
          </h2>
          <p className="text-xs text-amber-700 mb-3">
            {schedule.approvalStatus.admins.filter((a) => a.approved).length} de{" "}
            {schedule.approvalStatus.admins.length} administrador
            {schedule.approvalStatus.admins.length !== 1 ? "es" : ""} han validado.
          </p>
          <ul className="space-y-1">
            {schedule.approvalStatus.admins.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${a.approved ? "bg-emerald-500" : "bg-slate-300"}`}
                />
                <span className="text-slate-800">{a.name}</span>
                {a.isPrimaryAdmin && <span className="text-xs text-slate-400">(principal)</span>}
                <span className={`text-xs ${a.approved ? "text-emerald-600" : "text-slate-400"}`}>
                  {a.approved ? "Validado" : "Pendiente"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {notice && (
        <p className={`text-sm mb-3 ${unfilledCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>{notice}</p>
      )}

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : !schedule ? (
        <p className="text-slate-500">Todavía no se ha generado el cuadrante de este mes.</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="text-sm min-w-full">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-slate-50">Día</th>
                {service.posts.map((post) => (
                  <th key={post.id} className="px-3 py-2 text-left font-medium" colSpan={post.slotsPerDay}>
                    {post.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleDays.map((date) => (
                <tr key={date} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600 font-medium sticky left-0 bg-white">{formatDayLabel(date)}</td>
                  {service.posts.map((post) => {
                    const assigned = assignmentsByKey.get(`${date}|${post.id}`) ?? [];
                    return Array.from({ length: post.slotsPerDay }).map((_, i) => {
                      const existing = assigned[i];
                      return (
                        <td key={`${post.id}-${i}`} className="px-2 py-1.5">
                          <select
                            value={existing?.residentId ?? ""}
                            onChange={(e) => handleAssignChange(date, post.id, existing, e.target.value)}
                            className={`w-full border rounded-md px-2 py-1 text-xs ${
                              existing ? "border-slate-300" : "border-red-300 bg-red-50"
                            }`}
                          >
                            <option value="">— vacío —</option>
                            {activeResidents.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.user.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
