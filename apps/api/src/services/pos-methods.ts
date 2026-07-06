import { config } from "../config.js";
import { prisma } from "@onepara/db";
import type { PspProviderName } from "@onepara/shared";
import { getProvider } from "./psp/index.js";
import type { PspProvider } from "./psp/types.js";

const PROVIDERS: PspProviderName[] = ["mock", "paytr", "stripe", "sumup"];

export function isProviderConfigured(provider: string): boolean {
  switch (provider) {
    case "mock":
      return true;
    case "paytr":
      return !!(config.psp.paytr.merchantId && config.psp.paytr.merchantKey);
    case "stripe":
      return !!config.psp.stripe.secretKey;
    case "sumup":
      return !!config.psp.sumup.apiKey;
    default:
      return false;
  }
}

export async function listPosMethodsWithMeta() {
  const items = await prisma.posMethod.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return items.map((m) => ({
    ...m,
    configured: isProviderConfigured(m.provider),
  }));
}

export async function getEnabledPosMethodsForSite(siteMinDeposit: number) {
  const items = await prisma.posMethod.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return items
    .filter((m) => isProviderConfigured(m.provider))
    .map((m) => ({
      provider: m.provider,
      label: m.label,
      min: Math.max(Number(m.minAmount), siteMinDeposit),
      max: Number(m.maxAmount),
      isDefault: m.isDefault,
    }));
}

export async function resolvePosProvider(
  requestedProvider: string | null | undefined,
  siteMinDeposit: number,
): Promise<{ method: Awaited<ReturnType<typeof prisma.posMethod.findFirst>>; provider: PspProvider } | null> {
  const enabled = await prisma.posMethod.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const configured = enabled.filter((m) => isProviderConfigured(m.provider));

  let method = requestedProvider
    ? configured.find((m) => m.provider === requestedProvider)
    : configured.find((m) => m.isDefault) ?? configured[0];

  if (!method && configured.length === 0) {
    const fallback = config.psp.defaultProvider;
    if (!isProviderConfigured(fallback)) return null;
    return {
      method: null,
      provider: getProvider(fallback),
    };
  }

  if (!method) return null;

  return {
    method,
    provider: getProvider(method.provider as PspProviderName),
  };
}

export function validateAmountForMethod(
  amount: number,
  methodMin: number,
  methodMax: number,
  siteMinDeposit: number,
): string | null {
  const effectiveMin = Math.max(methodMin, siteMinDeposit);
  if (amount < effectiveMin) {
    return `Minimum yatırım tutarı ${effectiveMin} TL`;
  }
  if (amount > methodMax) {
    return `Maximum yatırım tutarı ${methodMax} TL`;
  }
  return null;
}

export { PROVIDERS };
