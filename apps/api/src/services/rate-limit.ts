import type { FastifyRequest } from "fastify";
import { prisma } from "@onepara/db";
import { error } from "./response.js";

export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
  reply: Parameters<typeof error>[0],
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - windowSec;

  await prisma.rateLimit.deleteMany({ where: { createdAt: { lt: since } } });

  const count = await prisma.rateLimit.count({
    where: { key, createdAt: { gte: since } },
  });

  if (count >= max) {
    reply.header("Retry-After", String(windowSec));
    error(reply, "Çok fazla istek. Lütfen bekleyin.", 429);
    return false;
  }

  await prisma.rateLimit.create({ data: { key, createdAt: now } });
  return true;
}

export function getClientIp(request: FastifyRequest): string {
  const cf = request.headers["cf-connecting-ip"];
  if (typeof cf === "string") return cf;
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0]?.trim() ?? "127.0.0.1";
  return request.ip ?? "127.0.0.1";
}

export async function byIp(
  request: FastifyRequest,
  suffix: string,
  max: number,
  windowSec: number,
  reply: Parameters<typeof error>[0],
): Promise<boolean> {
  return checkRateLimit(`ip:${getClientIp(request)}:${suffix}`, max, windowSec, reply);
}
