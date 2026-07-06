import { createHmac, timingSafeEqual } from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { config } from "../config.js";

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(secret: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  return authenticator.verify({ token: cleaned, secret });
}

export async function getQrDataUrl(secret: string, username: string, issuer = "OnePOS"): Promise<string> {
  const otpauth = authenticator.keyuri(username, issuer, secret);
  return QRCode.toDataURL(otpauth, { width: 220 });
}

export function makePartialToken(cashierId: number): string {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const payload = `${cashierId}:${expires}`;
  const sig = createHmac("sha256", config.app.secret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64")}.${sig}`;
}

export function verifyPartialToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts as [string, string];
  const payload = Buffer.from(payloadB64, "base64").toString("utf8");
  const expected = createHmac("sha256", config.app.secret).update(payload).digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  const [cashierIdStr, expiresStr] = payload.split(":");
  if (!cashierIdStr || !expiresStr) return null;
  if (Number(expiresStr) < Math.floor(Date.now() / 1000)) return null;
  return Number(cashierIdStr);
}
