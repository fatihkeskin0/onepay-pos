import type { FastifyRequest } from "fastify";
import type { TokenPayload } from "@onepara/shared";
import { prisma, Prisma } from "@onepara/db";
import { getClientIp } from "./rate-limit.js";

const SECRET_KEYS = new Set([
  "password",
  "totp_code",
  "passwordenc",
  "passwordhash",
  "totpsecret",
  "secret",
  "apikey",
  "token",
  "old_password",
  "new_password",
]);

export interface SystemActivityInput {
  category: string;
  action: string;
  title: string;
  target?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEYS.has(key.toLowerCase())) return "[REDACTED]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" && v ? redactObject(v as Record<string, unknown>) : v));
  if (typeof value === "object") return redactObject(value as Record<string, unknown>);
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

async function resolveActor(user: TokenPayload | null): Promise<{ actorId: number | null; actorUsername: string | null }> {
  if (!user?.id) return { actorId: null, actorUsername: null };
  const cashier = await prisma.cashier.findUnique({
    where: { id: user.id },
    select: { username: true },
  });
  return { actorId: user.id, actorUsername: cashier?.username ?? null };
}

export async function recordSystemActivity(
  request: FastifyRequest,
  user: TokenPayload | null,
  input: SystemActivityInput,
): Promise<void> {
  try {
    const { actorId, actorUsername } = await resolveActor(user);
    const payload = input.payload ? redactObject(input.payload) : undefined;

    await prisma.systemActivityLog.create({
      data: {
        category: input.category.slice(0, 30),
        action: input.action.slice(0, 60),
        title: input.title.slice(0, 200),
        actorId,
        actorUsername,
        userId: input.userId?.slice(0, 64) ?? null,
        ip: getClientIp(request).slice(0, 45) || null,
        target: input.target?.slice(0, 120) ?? null,
        payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    console.error("[system-activity] log failed:", err);
  }
}
