import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";
import type { PspFetchFn } from "../proxy/types.js";
import type { PspCallbackResult, PspPaymentInput, PspPaymentResult, PspProvider } from "./types.js";

const WEBHOOK_TOLERANCE_SEC = 300;

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

  const timestampSec = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSec)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > WEBHOOK_TOLERANCE_SEC) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  return signatures.some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}

/** Stripe PaymentIntent + Payment Element adapter */
export class StripeProvider implements PspProvider {
  name = "stripe" as const;
  readonly renderMode = "stripe_elements" as const;
  private readonly fetchFn: PspFetchFn;

  constructor(fetchFn: PspFetchFn = (url, init) => fetch(url, init)) {
    this.fetchFn = fetchFn;
  }

  async createPayment(input: PspPaymentInput): Promise<PspPaymentResult> {
    if (!config.psp.stripe.secretKey || !config.psp.stripe.publishableKey) {
      throw new Error("Stripe credentials not configured");
    }

    try {
      const res = await this.fetchFn("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.psp.stripe.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `dep_${input.depositId}_${input.reference}`,
        },
        body: new URLSearchParams({
          amount: String(Math.round(input.amount * 100)),
          currency: "try",
          "automatic_payment_methods[enabled]": "true",
          "metadata[deposit_id]": String(input.depositId),
        }),
      });

      const data = (await res.json()) as {
        id?: string;
        client_secret?: string;
        error?: { message?: string };
      };

      if (!res.ok || !data.id || !data.client_secret) {
        throw new Error(data.error?.message ?? "Stripe PaymentIntent creation failed");
      }

      return {
        providerRef: data.id,
        renderMode: this.renderMode,
        clientSecret: data.client_secret,
        publishableKey: config.psp.stripe.publishableKey,
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
      data?: {
        object?: {
          metadata?: { deposit_id?: string };
          id?: string;
          amount?: number;
          currency?: string;
        };
      };
    };

    const obj = event.data?.object;
    const depositId = Number(obj?.metadata?.deposit_id ?? 0);
    const providerRef = obj?.id;

    if (event.type === "payment_intent.succeeded" && depositId > 0) {
      return {
        valid: true,
        depositId,
        providerRef,
        status: "paid",
        rawPayload: event as Record<string, unknown>,
      };
    }

    if (event.type === "payment_intent.payment_failed" && depositId > 0) {
      return {
        valid: true,
        depositId,
        providerRef,
        status: "failed",
        rawPayload: event as Record<string, unknown>,
      };
    }

    return { valid: false, status: "failed", rawPayload: event as Record<string, unknown> };
  }

  async getStatus(providerRef: string): Promise<"paid" | "failed" | "processing"> {
    if (!config.psp.stripe.secretKey || !providerRef) return "processing";

    try {
      const res = await this.fetchFn(`https://api.stripe.com/v1/payment_intents/${providerRef}`, {
        headers: { Authorization: `Bearer ${config.psp.stripe.secretKey}` },
      });

      if (!res.ok) return "processing";

      const data = (await res.json()) as { status?: string };
      if (data.status === "succeeded") return "paid";
      if (data.status === "canceled") return "failed";
      return "processing";
    } catch {
      return "processing";
    }
  }
}
