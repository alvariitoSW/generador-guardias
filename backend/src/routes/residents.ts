import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prismaClient";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// Listado de todos los residentes (solo admin) — para gestión y para la generación de cuadrantes
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const residents = await prisma.resident.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, active: true, role: true, isPrimaryAdmin: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return res.json(residents);
});

const updateSchema = z.object({
  residencyYear: z.number().int().min(1).max(6).optional(),
  monthlyQuota: z.number().int().min(0).max(20).optional(),
  active: z.boolean().optional(),
  role: z.enum(["ADMIN", "RESIDENT"]).optional(),
});

// Admin puede editar cuota mensual, año de residencia y activar/desactivar.
// Solo el admin principal puede ascender a alguien a administrador o quitarle ese rol.
router.patch("/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { residencyYear, monthlyQuota, active, role } = parsed.data;

  if (role !== undefined && !req.auth!.isPrimaryAdmin) {
    return res.status(403).json({ error: "Solo el administrador principal puede nombrar o quitar administradores" });
  }

  const resident = await prisma.resident.findUnique({
    where: { id: String(req.params.id) },
    include: { user: { select: { isPrimaryAdmin: true } } },
  });
  if (!resident) return res.status(404).json({ error: "Residente no encontrado" });
  if (resident.user.isPrimaryAdmin && (role !== undefined || active === false)) {
    return res.status(400).json({ error: "No se puede cambiar el rol ni desactivar al administrador principal" });
  }

  const updated = await prisma.resident.update({
    where: { id: resident.id },
    data: {
      ...(residencyYear !== undefined ? { residencyYear } : {}),
      ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
      user:
        active !== undefined || role !== undefined
          ? {
              update: {
                ...(active !== undefined ? { active } : {}),
                ...(role !== undefined ? { role } : {}),
              },
            }
          : undefined,
    },
    include: { user: true },
  });

  return res.json(updated);
});

// Perfil propio del residente autenticado
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const resident = await prisma.resident.findUnique({
    where: { userId: req.auth!.userId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!resident) return res.status(404).json({ error: "No tienes perfil de residente" });
  return res.json(resident);
});

export default router;
