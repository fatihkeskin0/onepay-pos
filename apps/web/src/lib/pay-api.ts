import { payApiUrl } from "@/lib/api-base";
import {
  ApiRequestError,
  parseApiResponse,
  throwIfApiFailed,
  type ApiErrorCode,
} from "@/lib/http-errors";

type PayTheme = "light" | "dark";

export interface PaySessionInfo {
  token: string;
  amount: number;
  user_name: string;
  site_name: string;
  brand: { color: string; bg: string; theme: PayTheme; logo: string | null; name: string };
}

export interface PayLimits {
  min: number;
  max: number;
}

export type PspRenderMode = "redirect" | "iframe" | "stripe_elements";

export interface CreateDepositResult {
  reference: string;
  token: string;
  amount: number;
  redirect_url?: string | null;
  render_mode?: PspRenderMode;
  iframe_url?: string | null;
  client_secret?: string | null;
  publishable_key?: string | null;
  provider?: string;
}

export interface DepositStatusResult {
  status: string;
  reject_reason?: string;
}

export class PayApiError extends ApiRequestError {
  readonly payState: "expired" | "infrastructure" | "provider" | "validation" | "pending" | "generic";

  constructor(message: string, status: number, code?: ApiErrorCode, data: unknown = null) {
    super(message, status, code, data);
    this.name = "PayApiError";
    if (code === "POS_NOT_CONFIGURED" || status === 503) {
      this.payState = "infrastructure";
    } else if (code === "PSP_INIT_FAILED" || status === 502) {
      this.payState = "provider";
    } else if (code === "SESSION_EXPIRED" || status === 410) {
      this.payState = "expired";
    } else if (status === 409) {
      this.payState = "pending";
    } else if (status === 422) {
      this.payState = "validation";
    } else {
      this.payState = "generic";
    }
  }
}

async function payRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(payApiUrl(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new PayApiError("Bağlantı kurulamadı, lütfen tekrar deneyin.", 0, "UPSTREAM_UNAVAILABLE");
  }

  const data = await parseApiResponse<T>(res);
  try {
    return throwIfApiFailed(res, data);
  } catch (e) {
    if (e instanceof ApiRequestError) {
      throw new PayApiError(e.message, e.status, e.code, e.data);
    }
    throw e;
  }
}

export const PayAPI = {
  getPosMethods: (token: string) =>
    payRequest<{
      session: PaySessionInfo;
      payment_ready: boolean;
      limits: PayLimits | null;
      unavailable_reason?: string | null;
    }>("GET", `/user/pos_methods?token=${encodeURIComponent(token)}`),

  createDeposit: (sessionToken: string, amount: number) =>
    payRequest<CreateDepositResult>("POST", "/user/create_deposit", {
      session_token: sessionToken,
      amount,
    }),

  getDepositStatus: (ref: string, token: string) =>
    payRequest<DepositStatusResult>(
      "GET",
      `/user/deposit_status?ref=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}`,
    ),
};
