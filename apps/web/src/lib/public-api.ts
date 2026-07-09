import { apiUrl } from "@/lib/api-base";
import { parseApiResponse, throwIfPanelApiFailed } from "@/lib/http-errors";

export interface LandingInfo {
  telegram_support_username: string | null;
  telegram_url: string | null;
}

async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/public${path}`), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sunucuya ulaşılamıyor");
  }

  const data = await parseApiResponse<T>(res);
  return throwIfPanelApiFailed(res, data);
}

export const PublicAPI = {
  getLandingInfo: () => publicRequest<LandingInfo>("GET", "/landing-info"),
  submitApplication: (payload: {
    company_name: string;
    contact_name: string;
    email: string;
    telegram_username: string;
    message?: string;
  }) => publicRequest<{ submitted: boolean }>("POST", "/apply", payload),
};
