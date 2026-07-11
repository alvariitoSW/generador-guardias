import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prismaClient";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

async function getResidentIdForRequest(req: AuthRequest, requestedResidentId?: string) {
  if (req.auth!.role === "ADMIN" && requestedResidentId) {
    return requestedResidentId;
  }
  const resident = await prisma.resident.findUnique({ where: { userId: req.auth!.userId } });
  return resident?.id ?? null;
}

// Listar vacaciones: un residente ve las suyas, un admin puede ver las de cualquiera (?residentId=)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const residentId = await getResidentIdForRequest(req, req.query.residentId ? String(req.query.residentId) : undefined);
  if (!residentId) return res.status(404).json({ error: "No tienes perfil de residente" });

  const vacations = await prisma.vacation.findMany({
    where: { residentId },
    orderBy: { startDate: "asc" },
  });
  return res.json(vacations);
});

const createSchema = z.object({
  startDate: z.string().datetime().or(z.string().date()),
  endDate: z.string().datetime().or(z.string().date()),
  reason: z.string().optional(),
  residentId: z.string().optional(), // solo admin puede fijar un residente distinto al propio
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const residentId = await getResidentIdForRequest(req, parsed.data.residentId);
  if (!residentId) return res.status(404).json({ error: "No tienes perfil de residente" });

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (end < start) {
    return res.status(400).json({ error: "La fecha de fin no puede ser anterior a la de inicio" });
  }

  const vacation = await prisma.vacation.create({
    data: { residentId, startDate: start, endDate: end, reason: parsed.data.reason },
  });
  return res.status(201).json(vacation);
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const vacation = await prisma.vacation.findUnique({ where: { id: String(req.params.id) } });
  if (!vacation) return res.status(404).json({ error: "No encontrada" });

  const residentId = await getResidentIdForRequest(req, vacation.residentId);
  if (req.auth!.role !== "ADMIN" && vacation.residentId !== residentId) {
    return res.status(403).json({ error: "No autorizado" });
  }

  await prisma.vacation.delete({ where: { id: vacation.id } });
  return res.status(204).send();
});

export default router;
