import type { PspProviderName } from "@onepara/shared";
import { config } from "../../config.js";
import { getSetting } from "../callback.js";
import { MockProvider } from "./mock.js";
import { PayTrProvider } from "./paytr.js";
import { StripeProvider } from "./stripe.js";
import { SumUpProvider } from "./sumup.js";
import type { PspProvider } from "./types.js";

const providers: Record<PspProviderName, PspProvider> = {
  mock: new MockProvider(),
  paytr: new PayTrProvider(),
  stripe: new StripeProvider(),
  sumup: new SumUpProvider(),
};

export async function getActiveProvider(): Promise<PspProvider> {
  const fromDb = await getSetting("psp_default_provider");
  const name = (fromDb ?? config.psp.defaultProvider) as PspProviderName;
  return providers[name] ?? providers.mock;
}

export function getProvider(name: PspProviderName): PspProvider {
  return providers[name] ?? providers.mock;
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

export { providers };
