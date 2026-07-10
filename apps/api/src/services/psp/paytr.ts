import { createHmac } from "node:crypto";
import { config } from "../../config.js";
import type { PspFetchFn } from "../proxy/types.js";
import type { PspCallbackResult, PspPaymentInput, PspPaymentResult, PspProvider } from "./types.js";

interface PayTrTokenResponse {
  status?: string;
  token?: string;
  reason?: string;
  iframe_url?: string;
}

/** PayTR iFrame API adapter */
export class PayTrProvider implements PspProvider {
  name = "paytr" as const;
  readonly renderMode = "iframe" as const;
  private readonly fetchFn: PspFetchFn;

  constructor(fetchFn: PspFetchFn = (url, init) => fetch(url, init)) {
    this.fetchFn = fetchFn;
  }

  async createPayment(input: PspPaymentInput): Promise<PspPaymentResult> {
    const { paytr } = config.psp;
    if (!paytr.merchantId || !paytr.merchantKey || !paytr.merchantSalt) {
      throw new Error("PayTR credentials not configured");
    }

    const merchantOid = `PAYTR-${input.depositId}`;
    const amountKurus = Math.round(input.amount * 100);
    const amountTl = input.amount.toFixed(2);
    const email = input.email ?? `${input.userId}@onepos.pay`;
    const userIp = input.userIp ?? "127.0.0.1";
    const userBasket = Buffer.from(
      JSON.stringify([[`Deposit ${input.reference}`, amountTl, 1]]),
    ).toString("base64");

    const noInstallment = "0";
    const maxInstallment = "0";
    const currency = "TL";
    const testMode = paytr.testMode ? "1" : "0";

    const hashStr =
      paytr.merchantId +
      userIp +
      merchantOid +
      email +
      String(amountKurus) +
      userBasket +
      noInstallment +
      maxInstallment +
      currency +
      testMode;

    const paytrToken = createHmac("sha256", paytr.merchantKey)
      .update(hashStr + paytr.merchantSalt)
      .digest("base64");

    const okUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}ref=${encodeURIComponent(input.reference)}&status=success`;
    const failUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}ref=${encodeURIComponent(input.reference)}&status=fail`;

    const form = new URLSearchParams({
      merchant_id: paytr.merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: String(amountKurus),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: config.app.env === "development" ? "1" : "0",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: input.userName || input.userId,
      user_address: "Turkey",
      user_phone: "05555555555",
      merchant_ok_url: okUrl,
      merchant_fail_url: failUrl,
      timeout_limit: "30",
      currency,
      test_mode: testMode,
      lang: "tr",
      iframe_v2: "1",
      iframe_v2_dark: input.uiTheme === "dark" ? "1" : "0",
    });

    try {
      const res = await this.fetchFn("https://www.paytr.com/odeme/api/get-token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });

      const data = (await res.json()) as PayTrTokenResponse;

      if (data.status !== "success" || !data.token) {
        throw new Error(data.reason ?? "PayTR token request failed");
      }

      return {
        providerRef: merchantOid,
        renderMode: this.renderMode,
        iframeUrl:
          data.iframe_url ?? `https://www.paytr.com/odeme/guvenli/${data.token}`,
        status: "initiated",
        rawResponse: {
          merchantOid,
          token: data.token,
          total_amount: amountKurus,
          iframe_v2: true,
          iframe_v2_dark: input.uiTheme === "dark",
        },
      };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "PayTR request failed");
    }
  }

  async verifyCallback(
    body: unknown,
    _headers?: Record<string, string | string[] | undefined>,
    _rawBody?: string,
  ): Promise<PspCallbackResult> {
    const data = body as Record<string, string>;
    const hash = createHmac("sha256", config.psp.paytr.merchantKey)
      .update(`${data.merchant_oid}${config.psp.paytr.merchantSalt}${data.status}${data.total_amount}`)
      .digest("base64");

    const valid = hash === data.hash;
    const depositId = Number(String(data.merchant_oid ?? "").replace("PAYTR-", ""));

    return {
      valid,
      depositId: valid && depositId > 0 ? depositId : undefined,
      providerRef: data.merchant_oid,
      status: valid && data.status === "success" ? "paid" : valid ? "failed" : "failed",
      rawPayload: data,
    };
  }

  async getStatus(): Promise<"paid" | "failed" | "processing"> {
    return "processing";
  }
}
