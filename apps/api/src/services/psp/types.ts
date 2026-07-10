import type { PspProviderName } from "@onepara/shared";

export type PspRenderMode = "redirect" | "iframe" | "stripe_elements";

export interface PspPaymentInput {
  depositId: number;
  reference: string;
  amount: number;
  userId: string;
  userName: string;
  siteName: string;
  returnUrl: string;
  callbackUrl: string;
  userIp?: string;
  email?: string;
  uiTheme?: "light" | "dark";
}

export interface PspPaymentResult {
  providerRef: string;
  renderMode: PspRenderMode;
  redirectUrl?: string;
  iframeUrl?: string;
  clientSecret?: string;
  publishableKey?: string;
  status: "initiated" | "processing" | "paid" | "failed";
  rawResponse?: Record<string, unknown>;
}

export interface PspCallbackResult {
  valid: boolean;
  depositId?: number;
  providerRef?: string;
  status: "paid" | "failed" | "processing";
  rawPayload?: Record<string, unknown>;
}

export interface PspProvider {
  name: PspProviderName;
  readonly renderMode: PspRenderMode;
  createPayment(input: PspPaymentInput): Promise<PspPaymentResult>;
  verifyCallback(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: string,
  ): Promise<PspCallbackResult>;
  getStatus(providerRef: string): Promise<"paid" | "failed" | "processing">;
  refund?(providerRef: string, amount: number): Promise<boolean>;
}
