import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "../config.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

export function verifyBcSignature(body: string, signature: string): boolean {
  const expected = createHmac("sha256", config.bc.secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
  } catch {
    return false;
  }
}
