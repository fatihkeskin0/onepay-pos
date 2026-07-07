import type { PspProviderName } from "@onepara/shared";
import { config } from "../../config.js";
import { PayTrProvider } from "./paytr.js";
import { StripeProvider } from "./stripe.js";
import { SumUpProvider } from "./sumup.js";
import type { PspProvider, PspRenderMode } from "./types.js";

const providers: Record<PspProviderName, PspProvider> = {
  paytr: new PayTrProvider(),
  stripe: new StripeProvider(),
  sumup: new SumUpProvider(),
};

const ALL_NAMES: PspProviderName[] = ["paytr", "stripe", "sumup"];

export interface PspProviderMeta {
  name: PspProviderName;
  renderMode: PspRenderMode;
  configured: boolean;
}

export function isKnownProvider(name: string): name is PspProviderName {
  return ALL_NAMES.includes(name as PspProviderName) && name in providers;
}

export function getProvider(name: PspProviderName): PspProvider | null {
  return providers[name] ?? null;
}

/** Capability metadata — adding a POS = new adapter + one line in `providers`. */
export function getProviderMeta(name: PspProviderName): PspProviderMeta {
  const provider = getProvider(name);
  if (!provider) {
    return { name, renderMode: "redirect", configured: false };
  }

  let configured = true;

  if (name === "paytr") {
    configured = !!(
      config.psp.paytr.merchantId &&
      config.psp.paytr.merchantKey &&
      config.psp.paytr.merchantSalt
    );
  } else if (name === "stripe") {
    configured = !!(
      config.psp.stripe.secretKey &&
      config.psp.stripe.publishableKey &&
      config.psp.stripe.webhookSecret
    );
  } else if (name === "sumup") {
    configured = !!(config.psp.sumup.apiKey && config.psp.sumup.merchantCode);
  }

  return { name, renderMode: provider.renderMode, configured };
}

export async function handlePspPaid(depositId: number): Promise<void> {
  const { approveDeposit } = await import("../payment.js");
  const { depositApproved, depositUrl, getSiteCallback } = await import("../callback.js");

  const deposit = await approveDeposit(depositId, 0);
  if (!deposit?.siteId) return;

  const siteCb = await getSiteCallback(deposit.siteId);
  if (!siteCb) return;

  const url = depositUrl(siteCb);
  if (url) {
    await depositApproved(deposit, siteCb.apiKey, url);
  }
}

export async function handlePspFailed(depositId: number, reason = "PSP ödeme başarısız"): Promise<void> {
  const { rejectDeposit } = await import("../payment.js");
  const { depositRejected, depositUrl, getSiteCallback } = await import("../callback.js");

  const rejected = await rejectDeposit(depositId, 0, reason);
  if (!rejected?.siteId) return;

  const siteCb = await getSiteCallback(rejected.siteId);
  if (!siteCb) return;

  const url = depositUrl(siteCb);
  if (url) {
    await depositRejected(rejected, siteCb.apiKey, url);
  }
}

export { providers };
