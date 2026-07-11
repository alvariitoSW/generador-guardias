import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido en las variables de entorno");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface TokenPayload {
  userId: string;
  role: "ADMIN" | "RESIDENT";
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded as unknown as TokenPayload;
}
