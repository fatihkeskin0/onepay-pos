import type { PspProviderName } from "@onepara/shared";
import type { PspPaymentResult, PspRenderMode } from "./types.js";

const providerRenderModes: Record<PspProviderName, PspRenderMode> = {
  paytr: "iframe",
  stripe: "stripe_elements",
  sumup: "redirect",
};

interface StoredPspTx {
  redirectUrl: string | null;
  rawResponse: unknown;
  provider: string;
}

export function buildPspEmbedPayload(result: PspPaymentResult) {
  return {
    redirectUrl: result.iframeUrl ?? result.redirectUrl ?? null,
    rawResponse: {
      ...(result.rawResponse ?? {}),
      renderMode: result.renderMode,
      ...(result.clientSecret ? { clientSecret: result.clientSecret } : {}),
      ...(result.publishableKey ? { publishableKey: result.publishableKey } : {}),
    },
  };
}

export function extractPspEmbedFields(pspTx: StoredPspTx | undefined) {
  const raw = (pspTx?.rawResponse ?? {}) as Record<string, unknown>;
  const providerName = (pspTx?.provider ?? "stripe") as PspProviderName;
  const renderMode =
    (raw.renderMode as PspRenderMode | undefined) ?? providerRenderModes[providerName] ?? "redirect";

  const storedUrl = pspTx?.redirectUrl ?? null;
  const clientSecret = typeof raw.clientSecret === "string" ? raw.clientSecret : null;
  const publishableKey = typeof raw.publishableKey === "string" ? raw.publishableKey : null;

  return {
    render_mode: renderMode,
    iframe_url: renderMode === "iframe" ? storedUrl : null,
    redirect_url: renderMode === "redirect" ? storedUrl : null,
    client_secret: renderMode === "stripe_elements" ? clientSecret : null,
    publishable_key: renderMode === "stripe_elements" ? publishableKey : null,
  };
}
