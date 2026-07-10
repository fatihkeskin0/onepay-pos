import type { FastifyRequest } from "fastify";
import { prisma } from "@onepara/db";
import { error } from "../services/response.js";
import { verifyTotp } from "./totp.js";

export const CRITICAL_ACTIONS = {
  ADD_CASHIER: "add_cashier",
  RESET_CASHIER_PASSWORD: "reset_cashier_password",
  TOGGLE_CASHIER: "toggle_cashier",
  FORCE_LOGOUT: "force_logout",
  APPROVE_DEPOSIT: "approve_deposit",
  REJECT_DEPOSIT: "reject_deposit",
  UPDATE_DEPOSIT_AMOUNT: "update_deposit_amount",
  CHANGE_OWN_PASSWORD: "change_own_password",
  SAVE_POS_METHOD: "save_pos_method",
  TOGGLE_POS_METHOD: "toggle_pos_method",
} as const;

export type CriticalAction = (typeof CRITICAL_ACTIONS)[keyof typeof CRITICAL_ACTIONS];

export async function requireStepUp(
  request: FastifyRequest,
  reply: Parameters<typeof error>[0],
  cashierId: number,
): Promise<boolean> {
  const body = request.body as { totp_code?: string } | undefined;
  const code = String(body?.totp_code ?? "").trim();

  const cashier = await prisma.cashier.findUnique({
    where: { id: cashierId },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!cashier?.totpEnabled || !cashier.totpSecret) {
    error(reply, "2FA yapılandırılmamış", 403, null, "TOTP_REQUIRED");
    return false;
  }

  if (!code || !verifyTotp(cashier.totpSecret, code)) {
    error(reply, "2FA doğrulaması gerekli", 403, null, "STEP_UP_REQUIRED");
    return false;
  }

  return true;
}
