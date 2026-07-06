import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";
import type { PspCallbackResult, PspPaymentInput, PspPaymentResult, PspProvider } from "./types.js";

function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string): boolean {
  const parts: Record<string, string[]> = {};
  for (const item of sigHeader.split(",")) {
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    const key = item.slice(0, eq).trim();
    const val = item.slice(eq + 1).trim();
    if (!parts[key]) parts[key] = [];
    parts[key].push(val);
  }

  const timestamp = parts["t"]?.[0];
  const signatures = parts["v1"] ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  return signatures.some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}

/** Stripe Checkout Session adapter */
export class StripeProvider implements PspProvider {
  name = "stripe" as const;

  async createPayment(input: PspPaymentInput): Promise<PspPaymentResult> {
    if (!config.psp.stripe.secretKey) {
      throw new Error("Stripe credentials not configured");
    }

    const successUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}ref=${encodeURIComponent(input.reference)}&status=success`;
    const cancelUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}ref=${encodeURIComponent(input.reference)}&status=cancel`;

    try {
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.psp.stripe.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          "line_items[0][price_data][currency]": "try",
          "line_items[0][price_data][product_data][name]": `Deposit ${input.reference}`,
          "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
          "line_items[0][quantity]": "1",
          "metadata[deposit_id]": String(input.depositId),
        }),
      });

      const data = (await res.json()) as {
        id?: string;
        url?: string;
        error?: { message?: string };
      };

      if (!res.ok || !data.id) {
        throw new Error(data.error?.message ?? "Stripe session creation failed");
      }

      return {
        providerRef: data.id,
        redirectUrl: data.url,
        status: "initiated",
        rawResponse: data as Record<string, unknown>,
      };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Stripe request failed");
    }
  }

  async verifyCallback(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: string,
  ): Promise<PspCallbackResult> {
    const webhookSecret = config.psp.stripe.webhookSecret;
    if (!webhookSecret) {
      return { valid: false, status: "failed" };
    }

    const sigHeader = headers["stripe-signature"];
    if (!sigHeader || typeof sigHeader !== "string" || !rawBody) {
      return { valid: false, status: "failed" };
    }

    if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
      return { valid: false, status: "failed" };
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: { object?: { metadata?: { deposit_id?: string }; payment_status?: string; id?: string } };
    };

    const obj = event.data?.object;
    const depositId = Number(obj?.metadata?.deposit_id ?? 0);
    const paid = event.type === "checkout.session.completed" && obj?.payment_status === "paid";

    return {
      valid: paid && depositId > 0,
      depositId: paid ? depositId : undefined,
      providerRef: obj?.id,
      status: paid ? "paid" : "failed",
      rawPayload: event as Record<string, unknown>,
    };
  }

  async getStatus(): Promise<"paid" | "failed" | "processing"> {
    return "processing";
  }
}
