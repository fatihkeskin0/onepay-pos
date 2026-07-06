import { config } from "../../config.js";
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
      const res = await fetch("https://api.sumup.com/v0.1/checkouts", {
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
    const checkoutRef = data.checkout_reference ?? data.reference ?? "";
    const paid = (data.status ?? "").toUpperCase() === "PAID";

    return {
      valid: !!checkoutRef,
      depositId: undefined,
      providerRef: checkoutRef,
      status: paid ? "paid" : "failed",
      rawPayload: data,
    };
  }

  async getStatus(): Promise<"paid" | "failed" | "processing"> {
    return "processing";
  }
}
