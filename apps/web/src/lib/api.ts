import { LS_KEYS } from "@onepara/shared";
import { isPublicAuthPath } from "@/lib/auth-paths";

const BASE = "/backend";

function clearSessionKeepPreferences(): void {
  const theme = localStorage.getItem(LS_KEYS.theme);
  const seenAnn = localStorage.getItem(LS_KEYS.seenAnn);
  localStorage.clear();
  if (theme) localStorage.setItem(LS_KEYS.theme, theme);
  if (seenAnn) localStorage.setItem(LS_KEYS.seenAnn, seenAnn);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null;
  const publicAuth = isPublicAuthPath(path);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token && !publicAuth) headers.Authorization = `Bearer ${token}`;

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

  let data: { success: boolean; message: string; data: T };
  try {
    data = (await res.json()) as { success: boolean; message: string; data: T };
  } catch {
    throw new Error(res.ok ? "Geçersiz sunucu yanıtı" : "İstek başarısız");
  }

  if (res.status === 401) {
    if (token && !publicAuth) {
      clearSessionKeepPreferences();
      window.location.href = "/login";
    }
    throw new Error(data.message || "Yetkisiz");
  }

  if (res.status === 403) {
    throw new Error(data.message || "Bu işlem için yetkiniz yok");
  }

  if (!data.success) throw new Error(data.message || "İstek başarısız");
  return data.data;
}

export const API = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  download: async (path: string, filename: string): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { method: "GET", headers });
    } catch {
      throw new Error("Sunucuya ulaşılamıyor");
    }

    if (res.status === 401) {
      if (token) {
        clearSessionKeepPreferences();
        window.location.href = "/login";
      }
      throw new Error("Yetkisiz");
    }

    if (!res.ok) {
      let message = "İndirme başarısız";
      try {
        const data = (await res.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  token: () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null),
  role: () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.role) : null),
  username: () => (typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.username) : null),
  requireAuth: () => {
    if (!API.token()) window.location.href = "/login";
  },
  logout: async () => {
    const logId = localStorage.getItem(LS_KEYS.logId);
    try {
      await API.post("/cashier/logout", { log_id: logId ? Number(logId) : undefined });
    } catch {
      /* ignore */
    }
    clearSessionKeepPreferences();
    window.location.href = "/login";
  },
};
