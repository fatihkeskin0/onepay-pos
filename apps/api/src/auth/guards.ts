import type { FastifyRequest } from "fastify";
import { prisma } from "@onepara/db";
import type { TokenPayload } from "@onepara/shared";
import { error } from "../services/response.js";
import { getClientIp } from "../services/rate-limit.js";
import { verifyToken } from "./token.js";
import { validateSession } from "./session.js";

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

  if (!cashier.totpEnabled) {
    error(reply, "2FA kurulumu gerekli", 403, null, "TOTP_REQUIRED");
    return null;
  }

  const sessionState = await validateSession(user.id, user.sid);
  if (sessionState === "missing") {
    error(reply, "Oturum geçersiz, lütfen tekrar giriş yapın", 401, null, "SESSION_INVALID");
    return null;
  }
  if (sessionState === "superseded") {
    error(reply, "Başka bir cihazda oturum açıldı", 401, null, "SESSION_SUPERSEDED");
    return null;
  }
  if (sessionState === "unavailable") {
    error(reply, "Servis geçici olarak kullanılamıyor", 503, null, "UPSTREAM_UNAVAILABLE");
    return null;
  }

  if (cashier.ipLockEnabled && user.ip) {
    const currentIp = getClientIp(request);
    if (currentIp !== user.ip) {
      await prisma.cashier.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      error(reply, "IP adresi değişti, oturum sonlandırıldı", 401, null, "IP_CHANGED");
      return null;
    }
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
