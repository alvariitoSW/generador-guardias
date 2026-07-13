import { Router } from "express";
import { prisma } from "../prismaClient";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// Lista pública de nombres aún sin reclamar, para el selector del formulario de registro.
router.get("/available", async (_req, res) => {
  const names = await prisma.rosterName.findMany({
    where: { claimedByUserId: null },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  return res.json(names);
});

// Listado completo (admin) para ver quién ha reclamado qué nombre.
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const names = await prisma.rosterName.findMany({
    include: { claimedBy: { select: { id: true, email: true, name: true, active: true } } },
    orderBy: { fullName: "asc" },
  });
  return res.json(names);
});

export default router;
