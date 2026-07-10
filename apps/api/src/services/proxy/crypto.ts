import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "../../config.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptionKey(): Buffer {
  const raw = process.env.PROXY_ENCRYPTION_KEY?.trim() || config.app.secret;
  return createHash("sha256").update(raw).digest();
}

export function encryptProxySecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptProxySecret(enc: string): string {
  const parts = enc.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret");
  const ivB64 = parts[0];
  const tagB64 = parts[1];
  const dataB64 = parts[2];
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted secret");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
