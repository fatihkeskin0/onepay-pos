import { randomBytes } from "node:crypto";
import { getRedis } from "../services/redis.js";
import { TOKEN_TTL_SEC } from "./token.js";

function sessionKey(cashierId: number): string {
  return `session:cashier:${cashierId}`;
}

export function createSessionId(): string {
  return randomBytes(16).toString("hex");
}

export async function bindSession(cashierId: number, sessionId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(sessionKey(cashierId), sessionId, "EX", TOKEN_TTL_SEC);
  } catch {
    /* ignore — login still issues JWT; validateSession handles Redis outage */
  }
}

export async function validateSession(cashierId: number, sessionId: string | undefined): Promise<
  "ok" | "missing" | "superseded" | "unavailable"
> {
  if (!sessionId) return "missing";

  try {
    const redis = getRedis();
    const active = await redis.get(sessionKey(cashierId));
    if (active === null) return "superseded";
    if (active !== sessionId) return "superseded";
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function clearSession(cashierId: number): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(sessionKey(cashierId));
  } catch {
    /* ignore */
  }
}
