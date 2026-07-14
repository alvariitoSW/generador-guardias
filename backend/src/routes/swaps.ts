import { Router } from "express";
import { z } from "zod";
import { addDays, subDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "../prismaClient";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { OTHER_SERVICE_MIN_GAP_DAYS } from "../scheduling/generateSchedule";

const router = Router();

async function getResident(req: AuthRequest) {
  return prisma.resident.findUnique({ where: { userId: req.auth!.userId } });
}

const assignmentInclude = {
  post: true,
  resident: { include: { user: { select: { name: true, email: true } } } },
  scheduleMonth: true,
} as const;

const offerInclude = {
  offerer: { include: { user: { select: { name: true } } } },
  offeredAssignment: { include: assignmentInclude },
} as const;

/**
 * Comprueba si `residentId` podría legítimamente tener una guardia de
 * Urgencias en `date`, para validar un cambio antes de aplicarlo. Reproduce
 * las mismas reglas duras que el generador de cuadrantes (vacaciones,
 * descanso 24h, margen con guardias de otro servicio, día 1 si está
 * saliente, cuota mensual), pero contra el estado real en BD en vez de un
 * cuadrante en memoria. Devuelve un mensaje de error, o null si es válido.
 */
async function validateResidentCanTakeDate(params: {
  residentId: string;
  serviceId: string;
  date: Date;
  excludeAssignmentIds: string[];
}): Promise<string | null> {
  const { residentId, serviceId, date, excludeAssignmentIds } = params;
  const day = startOfDay(date);
  const year = day.getFullYear();
  const month = day.getMonth() + 1;

  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) return "Residente no encontrado";

  const vacation = await prisma.vacation.findFirst({
    where: { residentId, startDate: { lte: day }, endDate: { gte: day } },
  });
  if (vacation) return "coincide con unas vacaciones";

  const sameDay = await prisma.shiftAssignment.findFirst({
    where: { residentId, date: day, id: { notIn: excludeAssignmentIds } },
  });
  if (sameDay) return "ese día ya tiene otra guardia";

  const adjacent = await prisma.shiftAssignment.findFirst({
    where: {
      residentId,
      date: { in: [subDays(day, 1), addDays(day, 1)] },
      id: { notIn: excludeAssignmentIds },
    },
  });
  if (adjacent) return "no respeta el descanso de 24h entre guardias";

  const prefsWithOtherService = await prisma.preference.findMany({
    where: { residentId, serviceId, hasOtherServiceGuardias: true },
  });
  const otherServiceDates = prefsWithOtherService.flatMap(
    (p) => JSON.parse(p.otherServiceGuardiaDates) as string[]
  );
  const tooClose = otherServiceDates.some((iso) => {
    const otherDate = new Date(`${iso}T00:00:00`);
    return Math.abs(differenceInCalendarDays(day, otherDate)) < OTHER_SERVICE_MIN_GAP_DAYS;
  });
  if (tooClose) {
    return `no respeta el margen de ${OTHER_SERVICE_MIN_GAP_DAYS} días con una guardia de su servicio de origen`;
  }

  if (day.getDate() === 1) {
    const prefThisMonth = await prisma.preference.findUnique({
      where: { residentId_serviceId_year_month: { residentId, serviceId, year, month } },
    });
    if (prefThisMonth?.outgoingFirstDay) return "está marcado como saliente el día 1 de ese mes";
  }

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);
  const countThisMonth = await prisma.shiftAssignment.count({
    where: {
      residentId,
      post: { serviceId },
      date: { gte: monthStart, lte: monthEnd },
      id: { notIn: excludeAssignmentIds },
    },
  });
  const prefThisMonth = await prisma.preference.findUnique({
    where: { residentId_serviceId_year_month: { residentId, serviceId, year, month } },
  });
  const effectiveQuota =
    prefThisMonth?.reducedQuota != null && prefThisMonth.reducedQuota < resident.monthlyQuota
      ? prefThisMonth.reducedQuota
      : resident.monthlyQuota;
  if (countThisMonth + 1 > effectiveQuota) {
    return "superaría su objetivo de guardias de ese mes";
  }

  return null;
}

// Tablón de solicitudes abiertas: visible para cualquier residente autenticado.
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const me = await getResident(req);
  if (!me) return res.status(404).json({ error: "No tienes perfil de residente" });

  const requests = await prisma.swapRequest.findMany({
    where: { status: "OPEN" },
    include: {
      assignment: { include: assignmentInclude },
      requester: { include: { user: { select: { name: true } } } },
      offers: { where: { status: "PENDING" }, include: offerInclude, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json(requests);
});

// Mis propias solicitudes (para ver y gestionar las ofertas que me han hecho).
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  const me = await getResident(req);
  if (!me) return res.status(404).json({ error: "No tienes perfil de residente" });

  const requests = await prisma.swapRequest.findMany({
    where: { requesterId: me.id },
    include: {
      assignment: { include: assignmentInclude },
      offers: { include: offerInclude, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json(requests);
});

const createSchema = z.object({
  assignmentId: z.string(),
  note: z.string().max(300).optional(),
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const me = await getResident(req);
  if (!me) return res.status(404).json({ error: "No tienes perfil de residente" });

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: parsed.data.assignmentId },
    include: { scheduleMonth: true },
  });
  if (!assignment) return res.status(404).json({ error: "Guardia no encontrada" });
  if (assignment.residentId !== me.id) return res.status(403).json({ error: "Esa guardia no es tuya" });
  if (assignment.scheduleMonth.status !== "PUBLISHED") {
    return res.status(400).json({ error: "Solo se pueden pedir cambios de guardias ya publicadas" });
  }
  if (assignment.date < startOfDay(new Date())) {
    return res.status(400).json({ error: "No se puede pedir el cambio de una guardia ya pasada" });
  }

  const existingOpen = await prisma.swapRequest.findFirst({
    where: { assignmentId: assignment.id, status: "OPEN" },
  });
  if (existingOpen) {
    return res.status(409).json({ error: "Ya hay una solicitud abierta para esta guardia" });
  }

  const created = await prisma.swapRequest.create({
    data: { assignmentId: assignment.id, requesterId: me.id, note: parsed.data.note },
    include: { assignment: { include: assignmentInclude } },
  });
  return res.status(201).json(created);
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const me = await getResident(req);
  const swapRequest = await prisma.swapRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!swapRequest) return res.status(404).json({ error: "Solicitud no encontrada" });

  const isOwner = !!me && swapRequest.requesterId === me.id;
  if (!isOwner && req.auth!.role !== "ADMIN") {
    return res.status(403).json({ error: "No autorizado" });
  }
  if (swapRequest.status !== "OPEN") {
    return res.status(400).json({ error: "Esta solicitud ya no está abierta" });
  }

  await prisma.swapRequest.update({
    where: { id: swapRequest.id },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
  return res.status(204).send();
});

const offerSchema = z.object({
  offeredAssignmentId: z.string().nullable().optional(),
  note: z.string().max(300).optional(),
});

router.post("/:id/offers", requireAuth, async (req: AuthRequest, res) => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const me = await getResident(req);
  if (!me) return res.status(404).json({ error: "No tienes perfil de residente" });

  const swapRequest = await prisma.swapRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!swapRequest || swapRequest.status !== "OPEN") {
    return res.status(404).json({ error: "Solicitud no encontrada o ya cerrada" });
  }
  if (swapRequest.requesterId === me.id) {
    return res.status(400).json({ error: "No puedes ofertar en tu propia solicitud" });
  }

  let offeredAssignmentId: string | null = null;
  if (parsed.data.offeredAssignmentId) {
    const offeredAssignment = await prisma.shiftAssignment.findUnique({
      where: { id: parsed.data.offeredAssignmentId },
      include: { scheduleMonth: true },
    });
    if (!offeredAssignment) return res.status(404).json({ error: "Esa guardia no existe" });
    if (offeredAssignment.residentId !== me.id) return res.status(403).json({ error: "Esa guardia no es tuya" });
    if (offeredAssignment.scheduleMonth.status !== "PUBLISHED") {
      return res.status(400).json({ error: "Solo puedes ofrecer guardias ya publicadas" });
    }
    offeredAssignmentId = offeredAssignment.id;
  }

  const created = await prisma.swapOffer.create({
    data: { swapRequestId: swapRequest.id, offererId: me.id, offeredAssignmentId, note: parsed.data.note },
    include: offerInclude,
  });
  return res.status(201).json(created);
});

router.post("/:id/offers/:offerId/decline", requireAuth, async (req: AuthRequest, res) => {
  const me = await getResident(req);
  const swapRequest = await prisma.swapRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!swapRequest) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (!me || swapRequest.requesterId !== me.id) return res.status(403).json({ error: "No autorizado" });

  const offer = await prisma.swapOffer.findUnique({ where: { id: String(req.params.offerId) } });
  if (!offer || offer.swapRequestId !== swapRequest.id) {
    return res.status(404).json({ error: "Oferta no encontrada" });
  }

  await prisma.swapOffer.update({ where: { id: offer.id }, data: { status: "DECLINED" } });
  return res.status(204).send();
});

router.post("/:id/offers/:offerId/accept", requireAuth, async (req: AuthRequest, res) => {
  const me = await getResident(req);
  if (!me) return res.status(404).json({ error: "No tienes perfil de residente" });

  const swapRequest = await prisma.swapRequest.findUnique({
    where: { id: String(req.params.id) },
    include: { assignment: { include: { post: true } } },
  });
  if (!swapRequest || swapRequest.status !== "OPEN") {
    return res.status(404).json({ error: "Solicitud no encontrada o ya cerrada" });
  }
  if (swapRequest.requesterId !== me.id) {
    return res.status(403).json({ error: "Solo quien pidió el cambio puede aceptar una oferta" });
  }

  const offer = await prisma.swapOffer.findUnique({
    where: { id: String(req.params.offerId) },
    include: { offeredAssignment: true },
  });
  if (!offer || offer.swapRequestId !== swapRequest.id || offer.status !== "PENDING") {
    return res.status(404).json({ error: "Oferta no encontrada o ya resuelta" });
  }

  const requesterAssignment = swapRequest.assignment; // pasa al que oferta
  const offererAssignment = offer.offeredAssignment; // pasa a quien pidió el cambio (si la hay)
  const serviceId = requesterAssignment.post.serviceId;
  const excludeIds = [requesterAssignment.id, ...(offererAssignment ? [offererAssignment.id] : [])];

  const errorForOfferer = await validateResidentCanTakeDate({
    residentId: offer.offererId,
    serviceId,
    date: requesterAssignment.date,
    excludeAssignmentIds: excludeIds,
  });
  if (errorForOfferer) {
    return res.status(409).json({ error: `No se puede completar el cambio: ${errorForOfferer}` });
  }

  if (offererAssignment) {
    const errorForRequester = await validateResidentCanTakeDate({
      residentId: swapRequest.requesterId,
      serviceId,
      date: offererAssignment.date,
      excludeAssignmentIds: excludeIds,
    });
    if (errorForRequester) {
      return res.status(409).json({ error: `No se puede completar el cambio: ${errorForRequester}` });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.shiftAssignment.update({
      where: { id: requesterAssignment.id },
      data: { residentId: offer.offererId },
    });
    if (offererAssignment) {
      await tx.shiftAssignment.update({
        where: { id: offererAssignment.id },
        data: { residentId: swapRequest.requesterId },
      });
    }
    await tx.swapOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
    await tx.swapOffer.updateMany({
      where: { swapRequestId: swapRequest.id, id: { not: offer.id }, status: "PENDING" },
      data: { status: "DECLINED" },
    });
    await tx.swapRequest.update({
      where: { id: swapRequest.id },
      data: { status: "ACCEPTED", resolvedAt: new Date() },
    });
  });

  return res.json({ ok: true });
});

export default router;
