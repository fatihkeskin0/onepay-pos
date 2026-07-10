import { prisma } from "@onepara/db";
import type { Cashier } from "@onepara/db";
import { generateToken } from "./token.js";
import { bindSession, createSessionId } from "./session.js";

export interface LoginSessionResult {
  token: string;
  role: string;
  username: string;
  theme: string;
  log_id: number;
}

export async function completeLoginSession(
  cashier: Pick<Cashier, "id" | "username" | "role" | "siteId" | "tokenVersion" | "theme">,
  clientIp: string,
): Promise<LoginSessionResult> {
  const log = await prisma.loginLog.create({
    data: {
      cashierId: cashier.id,
      username: cashier.username,
      role: cashier.role,
      ip: clientIp,
    },
  });

  await prisma.cashier.update({
    where: { id: cashier.id },
    data: { lastLogin: new Date() },
  });

  const sessionId = createSessionId();
  await bindSession(cashier.id, sessionId);

  const token = generateToken(
    cashier.id,
    cashier.role,
    cashier.siteId,
    cashier.tokenVersion,
    clientIp,
    sessionId,
  );

  return {
    token,
    role: cashier.role,
    username: cashier.username,
    theme: cashier.theme,
    log_id: log.id,
  };
}
