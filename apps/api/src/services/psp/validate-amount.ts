import type { PspProviderName } from "@onepara/shared";
import type { PspCallbackResult } from "./types.js";

export function validatePspPaymentAmount(
  depositAmount: number,
  providerName: PspProviderName,
  result: PspCallbackResult,
): boolean {
  const expectedMinor = Math.round(depositAmount * 100);

  if (providerName === "paytr") {
    const raw = result.rawPayload as Record<string, string> | undefined;
    const total = Number(raw?.total_amount ?? 0);
    return Number.isFinite(total) && total === expectedMinor;
  }

  if (providerName === "stripe") {
    const event = result.rawPayload as {
      data?: { object?: { amount?: number; currency?: string } };
    };
    const obj = event?.data?.object;
    return (
      obj?.amount === expectedMinor && (obj?.currency ?? "").toLowerCase() === "try"
    );
  }

  if (providerName === "sumup") {
    const raw = result.rawPayload as { amount?: number; currency?: string; status?: string };
    if ((raw?.currency ?? "").toUpperCase() !== "TRY") return false;
    const paidAmount = Number(raw?.amount ?? 0);
    return Number.isFinite(paidAmount) && Math.abs(paidAmount - depositAmount) < 0.01;
  }

  return true;
}
