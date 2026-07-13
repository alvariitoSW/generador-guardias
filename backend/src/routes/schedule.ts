import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { generateSchedule, ResidentInput } from "../scheduling/generateSchedule";

const router = Router();

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const generateSchema = z.object({
  serviceId: z.string(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

// Genera (o regenera) el borrador del cuadrante mensual para un servicio
router.post("/generate", requireAuth, requireAdmin, async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { serviceId, year, month } = parsed.data;

  const service = await prisma.service.findUnique({ where: { id: serviceId }, include: { posts: true } });
  if (!service) return res.status(404).json({ error: "Servicio no encontrado" });
  if (service.posts.length === 0) {
    return res.status(400).json({ error: "El servicio no tiene puertas/puestos configurados" });
  }

  const residents = await prisma.resident.findMany({
    where: { user: { active: true } },
    include: { vacations: true, preferences: { where: { serviceId, year, month } } },
  });

  // Reparto a largo plazo: nº de guardias históricas de cada residente en este servicio
  const historicalCounts = await prisma.shiftAssignment.groupBy({
    by: ["residentId"],
    where: { post: { serviceId } },
    _count: { _all: true },
  });
  const historicalMap = new Map(historicalCounts.map((h) => [h.residentId, h._count._all]));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const residentInputs: ResidentInput[] = residents.map((r) => {
    const pref = r.preferences[0];
    return {
      id: r.id,
      monthlyQuota: r.monthlyQuota,
      active: true,
      historicalCount: historicalMap.get(r.id) ?? 0,
      vacations: r.vacations
        .filter((v) => v.startDate <= monthEnd && v.endDate >= monthStart)
        .map((v) => ({ start: v.startDate, end: v.endDate })),
      avoidWeekdays: pref ? JSON.parse(pref.avoidWeekdays) : [],
      avoidDates: pref ? JSON.parse(pref.avoidDates) : [],
      preferredDates: pref ? JSON.parse(pref.preferredDates) : [],
      outgoingFirstDay: pref?.outgoingFirstDay ?? false,
      preferredPostId: pref?.preferredPostId ?? null,
    };
  });

  const result = generateSchedule({
    year,
    month,
    posts: service.posts.map((p) => ({ id: p.id, slotsPerDay: p.slotsPerDay })),
    residents: residentInputs,
  });

  const scheduleMonth = await prisma.scheduleMonth.upsert({
    where: { serviceId_year_month: { serviceId, year, month } },
    create: { serviceId, year, month, generatedAt: new Date() },
    update: { generatedAt: new Date(), status: "DRAFT", publishedAt: null },
  });

  await prisma.shiftAssignment.deleteMany({ where: { scheduleMonthId: scheduleMonth.id } });
  if (result.assignments.length > 0) {
    await prisma.shiftAssignment.createMany({
      data: result.assignments.map((a) => ({
        scheduleMonthId: scheduleMonth.id,
        postId: a.postId,
        residentId: a.residentId,
        date: new Date(`${a.date}T00:00:00`),
      })),
    });
  }

  return res.status(201).json({
    scheduleMonth,
    unfilledSlots: result.unfilledSlots,
    stats: result.stats,
  });
});

async function loadScheduleMonth(serviceId: string, year: number, month: number) {
  return prisma.scheduleMonth.findUnique({
    where: { serviceId_year_month: { serviceId, year, month } },
    include: {
      assignments: {
        include: {
          post: true,
          resident: { include: { user: { select: { name: true, email: true } } } },
        },
        orderBy: [{ date: "asc" }, { post: { order: "asc" } }],
      },
    },
  });
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { serviceId, year, month } = req.query;
  if (!serviceId || !year || !month) {
    return res.status(400).json({ error: "serviceId, year y month son obligatorios" });
  }

  const scheduleMonth = await loadScheduleMonth(String(serviceId), Number(year), Number(month));
  if (!scheduleMonth) return res.json(null);

  if (scheduleMonth.status === "DRAFT" && req.auth!.role !== "ADMIN") {
    return res.status(403).json({ error: "El cuadrante de este mes aún no se ha publicado" });
  }

  return res.json(scheduleMonth);
});

const editSchema = z.object({ residentId: z.string() });

router.patch("/assignments/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.shiftAssignment.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Asignación no encontrada" });

  const clash = await prisma.shiftAssignment.findFirst({
    where: {
      residentId: parsed.data.residentId,
      date: existing.date,
      id: { not: existing.id },
    },
  });

  try {
    const updated = await prisma.shiftAssignment.update({
      where: { id: existing.id },
      data: { residentId: parsed.data.residentId },
      include: { post: true, resident: { include: { user: { select: { name: true, email: true } } } } },
    });
    return res.json({ assignment: updated, warning: clash ? "Este residente ya tiene guardia asignada ese día" : null });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Este residente ya está asignado a esa puerta ese día" });
    }
    throw err;
  }
});

router.delete("/assignments/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.shiftAssignment.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Asignación no encontrada" });
  await prisma.shiftAssignment.delete({ where: { id: existing.id } });
  return res.status(204).send();
});

const createAssignmentSchema = z.object({
  scheduleMonthId: z.string(),
  postId: z.string(),
  residentId: z.string(),
  date: z.string(),
});

router.post("/assignments", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { scheduleMonthId, postId, residentId, date } = parsed.data;

  try {
    const created = await prisma.shiftAssignment.create({
      data: { scheduleMonthId, postId, residentId, date: new Date(`${date}T00:00:00`) },
      include: { post: true, resident: { include: { user: { select: { name: true, email: true } } } } },
    });
    return res.status(201).json(created);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Este residente ya está asignado a esa puerta ese día" });
    }
    throw err;
  }
});

router.post("/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  const scheduleMonth = await prisma.scheduleMonth.findUnique({ where: { id: String(req.params.id) } });
  if (!scheduleMonth) return res.status(404).json({ error: "Cuadrante no encontrado" });

  const updated = await prisma.scheduleMonth.update({
    where: { id: scheduleMonth.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  return res.json(updated);
});

export default router;
