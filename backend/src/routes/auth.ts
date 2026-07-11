import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prismaClient";
import { signToken } from "../utils/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(2),
  residencyYear: z.number().int().min(1).max(6).optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, name, residencyYear } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // El primer usuario registrado en el sistema se convierte en ADMIN automáticamente.
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "ADMIN" : "RESIDENT";

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      resident: {
        create: { residencyYear },
      },
    },
    include: { resident: true },
  });

  const token = signToken({ userId: user.id, role: user.role });
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
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
  if (!user || !user.active) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = signToken({ userId: user.id, role: user.role });
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
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
    resident: user.resident,
  });
});

export default router;
