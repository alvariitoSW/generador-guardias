import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prismaClient";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

async function getResidentIdForRequest(req: AuthRequest, requestedResidentId?: string) {
  if (req.auth!.role === "ADMIN" && requestedResidentId) {
    return requestedResidentId;
  }
  const resident = await prisma.resident.findUnique({ where: { userId: req.auth!.userId } });
  return resident?.id ?? null;
}

const weekdayArray = z.array(z.number().int().min(1).max(5)); // 1=Lunes ... 5=Viernes
const dateArray = z.array(z.string());

const upsertSchema = z.object({
  serviceId: z.string(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  preferredWeekdays: weekdayArray.default([]),
  avoidWeekdays: weekdayArray.default([]),
  avoidDates: dateArray.default([]),
  preferredPostId: z.string().nullable().optional(),
  notes: z.string().optional(),
  residentId: z.string().optional(), // solo admin
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { serviceId, year, month } = req.query;
  if (!serviceId || !year || !month) {
    return res.status(400).json({ error: "serviceId, year y month son obligatorios" });
  }
  const residentId = await getResidentIdForRequest(req, req.query.residentId ? String(req.query.residentId) : undefined);
  if (!residentId) return res.status(404).json({ error: "No tienes perfil de residente" });

  const pref = await prisma.preference.findUnique({
    where: {
      residentId_serviceId_year_month: {
        residentId,
        serviceId: String(serviceId),
        year: Number(year),
        month: Number(month),
      },
    },
  });
  if (!pref) return res.json(null);

  return res.json({
    ...pref,
    preferredWeekdays: JSON.parse(pref.preferredWeekdays),
    avoidWeekdays: JSON.parse(pref.avoidWeekdays),
    avoidDates: JSON.parse(pref.avoidDates),
  });
});

router.put("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  const residentId = await getResidentIdForRequest(req, data.residentId);
  if (!residentId) return res.status(404).json({ error: "No tienes perfil de residente" });

  const preferredWeekdays = JSON.stringify(data.preferredWeekdays);
  const avoidWeekdays = JSON.stringify(data.avoidWeekdays);
  const avoidDates = JSON.stringify(data.avoidDates);

  const pref = await prisma.preference.upsert({
    where: {
      residentId_serviceId_year_month: {
        residentId,
        serviceId: data.serviceId,
        year: data.year,
        month: data.month,
      },
    },
    create: {
      residentId,
      serviceId: data.serviceId,
      year: data.year,
      month: data.month,
      preferredWeekdays,
      avoidWeekdays,
      avoidDates,
      preferredPostId: data.preferredPostId ?? null,
      notes: data.notes,
    },
    update: {
      preferredWeekdays,
      avoidWeekdays,
      avoidDates,
      preferredPostId: data.preferredPostId ?? null,
      notes: data.notes,
    },
  });

  return res.json({
    ...pref,
    preferredWeekdays: data.preferredWeekdays,
    avoidWeekdays: data.avoidWeekdays,
    avoidDates: data.avoidDates,
  });
});

export default router;
