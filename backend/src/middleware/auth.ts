import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";
import { prisma } from "../prismaClient";

export interface AuthRequest extends Request {
  auth?: TokenPayload;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }
  const token = header.slice("Bearer ".length);
  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  // Se comprueba en BD (no solo en el token) para que desactivar una cuenta
  // la deje fuera al instante, aunque su token todavía sea válido.
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { active: true, role: true } });
  if (!user || !user.active) {
    return res.status(401).json({ error: "Cuenta inactiva o pendiente de activación" });
  }

  req.auth = { userId: payload.userId, role: user.role };
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    return res.status(403).json({ error: "Requiere permisos de administrador" });
  }
  next();
}
