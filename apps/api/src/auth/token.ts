import { createHmac, timingSafeEqual } from "node:crypto";
import type { TokenPayload } from "@onepara/shared";
import { config } from "../config.js";

export const TOKEN_TTL_SEC = 86400;

function secret(): string {
  return config.app.secret;
}

export function generateToken(
  cashierId: number,
  role: string,
  siteId?: number | null,
  tokenVersion = 0,
  clientIp?: string,
  sessionId?: string,
): string {
  const payloadObj: Record<string, unknown> = {
    id: cashierId,
    role,
    tv: tokenVersion,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
  };
  if (siteId != null) payloadObj.site_id = siteId;
  if (clientIp) payloadObj.ip = clientIp;
  if (sessionId) payloadObj.sid = sessionId;

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
