import { randomBytes } from "node:crypto";
import { config } from "../../config.js";
import type { PspCallbackResult, PspPaymentInput, PspPaymentResult, PspProvider } from "./types.js";

export class MockProvider implements PspProvider {
  name = "mock" as const;

  async createPayment(input: PspPaymentInput): Promise<PspPaymentResult> {
    const providerRef = `MOCK-${input.depositId}-${randomBytes(4).toString("hex")}`;
    const base = config.app.paymentUrl;
    const redirectUrl = `${base}/pay/mock-3ds?ref=${encodeURIComponent(input.reference)}&deposit=${input.depositId}&pref=${providerRef}`;

    return {
      providerRef,
      redirectUrl,
      status: "initiated",
      rawResponse: { mock: true },
    };
  }

  async verifyCallback(
    body: unknown,
    _headers?: Record<string, string | string[] | undefined>,
    _rawBody?: string,
  ): Promise<PspCallbackResult> {
    const data = body as Record<string, string>;
    const depositId = Number(data.deposit_id);
    const providerRef = data.provider_ref ?? "";
    const status = data.status === "paid" ? "paid" : data.status === "failed" ? "failed" : "processing";

    return {
      valid: !!depositId && !!providerRef,
      depositId,
      providerRef,
      status,
      rawPayload: data,
    };
  }

  async getStatus(providerRef: string): Promise<"paid" | "failed" | "processing"> {
    if (providerRef.startsWith("MOCK-PAID")) return "paid";
    if (providerRef.startsWith("MOCK-FAIL")) return "failed";
    return "processing";
  }

  async refund(): Promise<boolean> {
    return true;
  }
}
