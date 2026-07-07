import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyRequest } from "fastify";
import { prisma } from "@onepara/db";
import type { TokenPayload } from "@onepara/shared";
import { config } from "../config.js";
import { error } from "./response.js";

function secret(): string {
  return config.app.secret;
}

export function generateToken(
  cashierId: number,
  role: string,
  siteId?: number | null,
  tokenVersion = 0,
): string {
  const payloadObj: Record<string, unknown> = {
    id: cashierId,
    role,
    tv: tokenVersion,
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
  if (siteId != null) payloadObj.site_id = siteId;

  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64");
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts as [string, string];
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  const data = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as TokenPayload;
  if (!data?.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: Parameters<typeof error>[0],
  ...roles: string[]
): Promise<TokenPayload | null> {
  const header = request.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const user = verifyToken(token);

  if (!user) {
    error(reply, "Yetkisiz", 401);
    return null;
  }

  if (roles.length && !roles.includes(user.role)) {
    error(reply, "Bu işlem için yetkiniz yok", 403);
    return null;
  }

  const cashier = await prisma.cashier.findUnique({ where: { id: user.id } });
  if (!cashier?.isActive) {
    error(reply, "Hesabınız devre dışı bırakıldı", 401);
    return null;
  }

  if ((cashier.tokenVersion ?? 0) > (user.tv ?? 0)) {
    error(reply, "Oturum sonlandırıldı", 401);
    return null;
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000);
  if (user.role === "kasiyer" || user.role === "admin") {
    if (!cashier.lastSeenAt || cashier.lastSeenAt < oneMinuteAgo) {
      await prisma.cashier.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
    }
  }

  return user;
}

export function verifyBcSignature(body: string, signature: string): boolean {
  const expected = createHmac("sha256", config.bc.secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}
