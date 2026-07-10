import { config } from "../../config.js";
import type { PspFetchFn } from "../proxy/types.js";
import type { PspCallbackResult, PspPaymentInput, PspPaymentResult, PspProvider } from "./types.js";

interface SumUpCheckoutResponse {
  id?: string;
  checkout_reference?: string;
  status?: string;
  message?: string;
  error_message?: string;
}

/** SumUp Checkouts API adapter */
export class SumUpProvider implements PspProvider {
  name = "sumup" as const;
  readonly renderMode = "redirect" as const;
  private readonly fetchFn: PspFetchFn;

  constructor(fetchFn: PspFetchFn = (url, init) => fetch(url, init)) {
    this.fetchFn = fetchFn;
  }

  async createPayment(input: PspPaymentInput): Promise<PspPaymentResult> {
    if (!config.psp.sumup.apiKey || !config.psp.sumup.merchantCode) {
      throw new Error("SumUp credentials not configured");
    }

    const returnUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}ref=${encodeURIComponent(input.reference)}&status=success`;

    const payload = {
      checkout_reference: input.reference,
      amount: input.amount,
      currency: "TRY",
      merchant_code: config.psp.sumup.merchantCode,
      description: `Deposit ${input.reference}`,
      return_url: returnUrl,
    };

    try {
      const res = await this.fetchFn("https://api.sumup.com/v0.1/checkouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.psp.sumup.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as SumUpCheckoutResponse;

      if (!res.ok || !data.id) {
        throw new Error(data.message ?? data.error_message ?? "SumUp checkout creation failed");
      }

      return {
        providerRef: data.id,
        renderMode: this.renderMode,
        redirectUrl: `https://checkout.sumup.com/pay/${data.id}`,
        status: "initiated",
        rawResponse: data as Record<string, unknown>,
      };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "SumUp request failed");
    }
  }

  async verifyCallback(
    body: unknown,
    _headers?: Record<string, string | string[] | undefined>,
    _rawBody?: string,
  ): Promise<PspCallbackResult> {
    const data = body as Record<string, string>;
    const checkoutId = data.id ?? data.checkout_id ?? "";

    if (!checkoutId || !config.psp.sumup.apiKey) {
      return { valid: false, status: "failed" };
    }

    try {
      const res = await this.fetchFn(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
        headers: { Authorization: `Bearer ${config.psp.sumup.apiKey}` },
      });

      if (!res.ok) {
        return { valid: false, status: "failed" };
      }

      const checkout = (await res.json()) as {
        status?: string;
        checkout_reference?: string;
        amount?: number;
        currency?: string;
      };

      const status = (checkout.status ?? "").toUpperCase();
      const paid = status === "PAID";
      const failed = status === "FAILED" || status === "EXPIRED";

      if (!paid && !failed) {
        return { valid: false, status: "processing", rawPayload: checkout as Record<string, unknown> };
      }

      return {
        valid: true,
        providerRef: checkoutId,
        status: paid ? "paid" : "failed",
        rawPayload: checkout as Record<string, unknown>,
      };
    } catch {
      return { valid: false, status: "failed" };
    }
  }

  async getStatus(): Promise<"paid" | "failed" | "processing"> {
    return "processing";
  }
}
