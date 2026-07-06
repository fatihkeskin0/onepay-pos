import { LS_KEYS } from "@onepara/shared";

const BASE = "/backend";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sunucuya ulaşılamıyor");
  }

  const data = (await res.json()) as { success: boolean; message: string; data: T };

  if (res.status === 401) {
    const theme = localStorage.getItem(LS_KEYS.theme);
    const seenAnn = localStorage.getItem(LS_KEYS.seenAnn);
    localStorage.clear();
    if (theme) localStorage.setItem(LS_KEYS.theme, theme);
    if (seenAnn) localStorage.setItem(LS_KEYS.seenAnn, seenAnn);
    window.location.href = "/login";
    throw new Error("Yetkisiz");
  }

  if (!data.success) throw new Error(data.message);
  return data.data;
}

export const API = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  token: () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null),
  role: () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.role) : null),
  username: () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.username) : null),
  requireAuth: () => {
    if (!API.token()) window.location.href = "/login";
  },
  logout: async () => {
    const logId = localStorage.getItem(LS_KEYS.logId);
    const theme = localStorage.getItem(LS_KEYS.theme);
    const seenAnn = localStorage.getItem(LS_KEYS.seenAnn);
    try {
      await API.post("/cashier/logout", { log_id: logId ? Number(logId) : undefined });
    } catch {
      /* ignore */
    }
    localStorage.clear();
    if (theme) localStorage.setItem(LS_KEYS.theme, theme);
    if (seenAnn) localStorage.setItem(LS_KEYS.seenAnn, seenAnn);
    window.location.href = "/login";
  },
};
