import { useEffect, useState, useCallback } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { ShiftAssignment, SwapRequest } from "../../api/types";
import { useServices } from "../../hooks/useServices";
import { useMyResident } from "../../hooks/useMyResident";

const today = new Date();

function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export function SwapsPage() {
  const { services } = useServices();
  const { resident } = useMyResident();
  const service = services[0];

  const [myAssignments, setMyAssignments] = useState<ShiftAssignment[]>([]);
  const [openRequests, setOpenRequests] = useState<SwapRequest[]>([]);
  const [myRequests, setMyRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newAssignmentId, setNewAssignmentId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(() => {
    if (!service || !resident) return;
    setLoading(true);
    setError(null);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthParams = [
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      { year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 },
    ];
    Promise.all([
      ...monthParams.map((p) =>
        api
          .get("/schedule", { params: { serviceId: service.id, ...p } })
          .then((res) => res.data?.assignments ?? [])
          .catch(() => [])
      ),
      api.get<SwapRequest[]>("/swaps"),
      api.get<SwapRequest[]>("/swaps/mine"),
    ])
      .then(([monthA, monthB, open, mine]) => {
        const todayIso = isoDay(today);
        const mineAssignments = [...monthA, ...monthB]
          .filter((a: ShiftAssignment) => a.residentId === resident.id && a.date.slice(0, 10) >= todayIso)
          .sort((a: ShiftAssignment, b: ShiftAssignment) => a.date.localeCompare(b.date));
        setMyAssignments(mineAssignments);
        setOpenRequests(open.data);
        setMyRequests(mine.data);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [service, resident]);

  useEffect(loadAll, [loadAll]);

  async function handleCreateRequest() {
    if (!newAssignmentId) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.post("/swaps", { assignmentId: newAssignmentId, note: newNote || undefined });
      setNewAssignmentId("");
      setNewNote("");
      setNotice("Solicitud publicada. Ya la pueden ver el resto de residentes.");
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId: string) {
    setError(null);
    try {
      await api.delete(`/swaps/${requestId}`);
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleRespond(requestId: string, offeredAssignmentId: string, note: string) {
    setError(null);
    setNotice(null);
    try {
      await api.post(`/swaps/${requestId}/offers`, {
        offeredAssignmentId: offeredAssignmentId || null,
        note: note || undefined,
      });
      setNotice("Oferta enviada.");
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleAccept(requestId: string, offerId: string) {
    setError(null);
    setNotice(null);
    try {
      await api.post(`/swaps/${requestId}/offers/${offerId}/accept`);
      setNotice("Cambio realizado.");
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDecline(requestId: string, offerId: string) {
    setError(null);
    try {
      await api.post(`/swaps/${requestId}/offers/${offerId}/decline`);
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (!service || !resident) return <p className="text-slate-500">Cargando...</p>;

  const myOpenAssignmentIds = new Set(
    myRequests.filter((r) => r.status === "OPEN").map((r) => r.assignmentId)
  );
  const availableToOffer = myAssignments.filter((a) => !myOpenAssignmentIds.has(a.id));
  const marketplaceRequests = openRequests.filter((r) => r.requesterId !== resident.id);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Cambios de guardia</h1>
        <p className="text-sm text-slate-500">
          Pide cambiar una de tus guardias publicadas; queda visible para todos por si alguien quiere cambiarla
          contigo.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Pedir un cambio</h2>
        {myAssignments.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes guardias publicadas próximamente.</p>
        ) : (
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tu guardia</label>
              <select
                value={newAssignmentId}
                onChange={(e) => setNewAssignmentId(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Selecciona una guardia</option>
                {myAssignments
                  .filter((a) => !myOpenAssignmentIds.has(a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatDate(a.date)} · {a.post.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-500 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                placeholder="Por qué quieres cambiarla"
              />
            </div>
            <button
              onClick={handleCreateRequest}
              disabled={!newAssignmentId || submitting}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Publicar solicitud
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Tablón de cambios abiertos</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : marketplaceRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No hay solicitudes abiertas ahora mismo.</p>
        ) : (
          <ul className="space-y-3">
            {marketplaceRequests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                myAssignments={availableToOffer}
                onRespond={(assignmentId, note) => handleRespond(r.id, assignmentId, note)}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Mis solicitudes</h2>
        {myRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No has pedido ningún cambio.</p>
        ) : (
          <ul className="space-y-3">
            {myRequests.map((r) => (
              <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-slate-800">
                      {formatDate(r.assignment.date)} · {r.assignment.post.name}
                    </span>
                    {r.note && <span className="text-xs text-slate-500 ml-2">"{r.note}"</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.status === "OPEN"
                          ? "bg-amber-100 text-amber-700"
                          : r.status === "ACCEPTED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.status === "OPEN" ? "Abierta" : r.status === "ACCEPTED" ? "Cambiada" : "Cancelada"}
                    </span>
                    {r.status === "OPEN" && (
                      <button onClick={() => handleCancel(r.id)} className="text-xs text-red-600 hover:underline">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
                {r.status === "OPEN" && r.offers.filter((o) => o.status === "PENDING").length > 0 && (
                  <ul className="space-y-2 mt-2">
                    {r.offers
                      .filter((o) => o.status === "PENDING")
                      .map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{o.offerer.user.name}</span>{" "}
                            {o.offeredAssignment
                              ? `ofrece ${formatDate(o.offeredAssignment.date)} · ${o.offeredAssignment.post.name}`
                              : "quiere quedarse tu guardia sin ofrecer nada a cambio"}
                            {o.note && <span className="text-slate-500"> — "{o.note}"</span>}
                          </span>
                          <span className="flex gap-2">
                            <button
                              onClick={() => handleAccept(r.id, o.id)}
                              className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-md hover:bg-emerald-700"
                            >
                              Aceptar
                            </button>
                            <button
                              onClick={() => handleDecline(r.id, o.id)}
                              className="text-xs text-slate-500 hover:text-red-600"
                            >
                              Rechazar
                            </button>
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequestCard({
  request,
  myAssignments,
  onRespond,
}: {
  request: SwapRequest;
  myAssignments: ShiftAssignment[];
  onRespond: (offeredAssignmentId: string, note: string) => void;
}) {
  const [offeredAssignmentId, setOfferedAssignmentId] = useState("");
  const [note, setNote] = useState("");
  const alreadyOffered = request.offers.some((o) => o.status === "PENDING");

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="mb-2">
        <span className="text-sm font-medium text-slate-800">
          {formatDate(request.assignment.date)} · {request.assignment.post.name}
        </span>
        <span className="text-xs text-slate-500 ml-2">pedida por {request.requester?.user.name}</span>
        {request.note && <p className="text-xs text-slate-500 mt-1">"{request.note}"</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Ofrecer a cambio (opcional)</label>
          <select
            value={offeredAssignmentId}
            onChange={(e) => setOfferedAssignmentId(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Sin ofrecer nada</option>
            {myAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {formatDate(a.date)} · {a.post.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="flex-1 min-w-[140px] border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={() => onRespond(offeredAssignmentId, note)}
          className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700"
        >
          Responder
        </button>
      </div>
      {alreadyOffered && <p className="text-xs text-slate-400 mt-2">Ya hay ofertas pendientes en esta solicitud.</p>}
    </li>
  );
}
