import { config } from "../config.js";
import { prisma } from "@onepara/db";
import type { PspProviderName } from "@onepara/shared";
import { getProvider } from "./psp/index.js";
import type { PspProvider } from "./psp/types.js";
import { getOrSet, invalidatePrefix } from "./cache.js";

const PROVIDERS: PspProviderName[] = ["paytr", "stripe", "sumup"];
const POS_CACHE_TTL_SEC = 30;

async function fetchEnabledPosMethods() {
  return prisma.posMethod.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function invalidatePosMethodsCache(): Promise<void> {
  await invalidatePrefix("pos:");
}

export function isProviderConfigured(provider: string): boolean {
  switch (provider) {
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
  const items = await getOrSet(`pos:enabled`, POS_CACHE_TTL_SEC, fetchEnabledPosMethods);

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

export async function activateSinglePosMethod(provider: string): Promise<void> {
  await prisma.$transaction([
    prisma.posMethod.updateMany({ data: { enabled: false, isDefault: false } }),
    prisma.posMethod.update({ where: { provider }, data: { enabled: true, isDefault: true } }),
  ]);
  await invalidatePosMethodsCache();
}

export async function deactivatePosMethod(provider: string): Promise<void> {
  await prisma.posMethod.update({
    where: { provider },
    data: { enabled: false, isDefault: false },
  });
  await invalidatePosMethodsCache();
}

export async function getActivePosMethodForSite(siteMinDeposit: number) {
  const methods = await getEnabledPosMethodsForSite(siteMinDeposit);
  if (methods.length === 0) return null;
  return methods.find((m) => m.isDefault) ?? methods[0];
}

export async function resolvePosProvider(
  requestedProvider: string | null | undefined,
  siteMinDeposit: number,
): Promise<{ method: Awaited<ReturnType<typeof prisma.posMethod.findFirst>>; provider: PspProvider } | null> {
  const enabled = await getOrSet(`pos:enabled`, POS_CACHE_TTL_SEC, fetchEnabledPosMethods);

  const configured = enabled.filter((m) => isProviderConfigured(m.provider));

  if (configured.length === 0) {
    const fallback = config.psp.defaultProvider;
    if (!isProviderConfigured(fallback)) return null;
    const provider = getProvider(fallback);
    if (!provider) return null;
    return {
      method: null,
      provider,
    };
  }

  const active = configured.find((m) => m.isDefault) ?? configured[0];
  if (!active) return null;

  if (requestedProvider && requestedProvider !== active.provider) {
    return null;
  }

  const provider = getProvider(active.provider as PspProviderName);
  if (!provider) return null;

  return {
    method: active,
    provider,
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
