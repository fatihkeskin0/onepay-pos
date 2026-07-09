import type { FastifyRequest } from "fastify";
import { getRedis } from "./redis.js";
import { error } from "./response.js";
import { shouldSkipRateLimit } from "./trusted-ip.js";

export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
  reply: Parameters<typeof error>[0],
  failClosed = true,
): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;

  try {
    const redis = getRedis();
    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    if (count > max) {
      const ttl = await redis.ttl(redisKey);
      reply.header("Retry-After", String(ttl > 0 ? ttl : windowSec));
      error(reply, "Çok fazla istek. Lütfen bekleyin.", 429, null, "RATE_LIMITED");
      return false;
    }

    return true;
  } catch (err) {
    console.error("[rate-limit] Redis error:", err);
    if (failClosed) {
      error(reply, "Servis geçici olarak kullanılamıyor", 503, null, "UPSTREAM_UNAVAILABLE");
      return false;
    }
    return true;
  }
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
  failClosed = true,
): Promise<boolean> {
  const clientIp = getClientIp(request);
  try {
    if (await shouldSkipRateLimit(clientIp)) return true;
  } catch (err) {
    console.error("[rate-limit] trusted-ip check failed:", err);
  }
  return checkRateLimit(`ip:${clientIp}:${suffix}`, max, windowSec, reply, failClosed);
}
