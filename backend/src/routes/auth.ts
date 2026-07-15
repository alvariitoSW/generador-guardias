import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prismaClient";
import { signToken } from "../utils/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { notifyAdminOfRegistration } from "../utils/mailer";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rosterNameId: z.string().min(1, "Elige tu nombre de la lista"),
  residencyYear: z.number().int().min(1).max(6).optional(),
});

// Un residente se registra eligiendo su nombre real de la lista (no lo escribe libremente),
// para que cada cuenta quede atada a una persona conocida. La cuenta queda inactiva hasta
// que un administrador la active desde el panel de Residentes.
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, rosterNameId, residencyYear } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const rosterName = await prisma.rosterName.findUnique({ where: { id: rosterNameId } });
  if (!rosterName) {
    return res.status(404).json({ error: "Ese nombre no está en la lista de residentes" });
  }
  if (rosterName.claimedByUserId) {
    return res.status(409).json({ error: "Ese nombre ya ha sido reclamado por otra cuenta" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: rosterName.fullName,
          role: "RESIDENT",
          active: false,
          resident: { create: { residencyYear } },
        },
      });

      // Reclama el nombre de forma atómica: si otra petición se adelantó, esto no actualiza nada.
      const claim = await tx.rosterName.updateMany({
        where: { id: rosterNameId, claimedByUserId: null },
        data: { claimedByUserId: user.id },
      });
      if (claim.count === 0) {
        throw new Error("ROSTER_TAKEN");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ROSTER_TAKEN") {
      return res.status(409).json({ error: "Ese nombre ya ha sido reclamado por otra cuenta" });
    }
    throw err;
  }

  await notifyAdminOfRegistration({ residentName: rosterName.fullName, email });

  return res.status(201).json({
    pending: true,
    message: "Registro recibido. Un administrador debe activar tu cuenta antes de que puedas entrar.",
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email o contraseña inválidos" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  if (!user.active) {
    return res.status(403).json({ error: "Tu cuenta todavía no ha sido activada por un administrador." });
  }

  const token = signToken({ userId: user.id, role: user.role });
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, isPrimaryAdmin: user.isPrimaryAdmin },
  });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { resident: true },
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isPrimaryAdmin: user.isPrimaryAdmin,
    resident: user.resident,
  });
});

const updateMeSchema = z.object({
  name: z.string().min(1, "El nombre no puede estar vacío").optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres").optional(),
});

// Cada cuenta puede editar sus propios datos. Los residentes mantienen su nombre
// fijo (viene de haber reclamado su nombre real de la lista): solo pueden cambiar
// email y contraseña. Cambiar email o contraseña exige confirmar la contraseña actual.
router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, email, currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (name !== undefined && user.role !== "ADMIN") {
    return res.status(403).json({ error: "Tu nombre está ligado al residente que reclamaste al registrarte y no se puede cambiar" });
  }

  const wantsEmailChange = email !== undefined && email !== user.email;
  const wantsPasswordChange = newPassword !== undefined;
  if (wantsEmailChange || wantsPasswordChange) {
    if (!currentPassword) {
      return res.status(400).json({ error: "Introduce tu contraseña actual para confirmar el cambio" });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "La contraseña actual no es correcta" });
  }

  if (wantsEmailChange) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(wantsEmailChange ? { email } : {}),
      ...(wantsPasswordChange ? { passwordHash: await bcrypt.hash(newPassword!, 10) } : {}),
    },
  });

  return res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    isPrimaryAdmin: updated.isPrimaryAdmin,
  });
});

export default router;
