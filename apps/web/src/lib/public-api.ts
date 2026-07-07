interface PublicApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/backend/public${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sunucuya ulaşılamıyor");
  }

  let data: PublicApiEnvelope<T>;
  try {
    data = (await res.json()) as PublicApiEnvelope<T>;
  } catch {
    throw new Error("Geçersiz sunucu yanıtı");
  }

  if (!data.success) throw new Error(data.message || "İstek başarısız");
  return data.data;
}

export interface LandingInfo {
  telegram_support_username: string | null;
  telegram_url: string | null;
}

export const PublicAPI = {
  getLandingInfo: () => publicRequest<LandingInfo>("GET", "/landing-info"),
  submitApplication: (payload: {
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    message?: string;
  }) => publicRequest<{ submitted: boolean }>("POST", "/apply", payload),
};
