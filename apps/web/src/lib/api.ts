import { LS_KEYS } from "@onepara/shared";
import { redirectToLogin } from "@/lib/auth-redirect";
import { isPublicAuthPath } from "@/lib/auth-paths";
import { apiUrl } from "@/lib/api-base";
import { parseApiResponse, throwIfPanelApiFailed } from "@/lib/http-errors";

const PANEL_FETCH_TIMEOUT_MS = 15_000;

function clearSessionKeepPreferences(): void {
  const theme = localStorage.getItem(LS_KEYS.theme);
  const seenAnn = localStorage.getItem(LS_KEYS.seenAnn);
  localStorage.clear();
  if (theme) localStorage.setItem(LS_KEYS.theme, theme);
  if (seenAnn) localStorage.setItem(LS_KEYS.seenAnn, seenAnn);
}

function isAbortTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null;
  const publicAuth = isPublicAuthPath(path);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token && !publicAuth) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(PANEL_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (isAbortTimeout(err)) {
      throw new Error("Sunucu yanıt vermedi");
    }
    throw new Error("Sunucuya ulaşılamıyor");
  }

  const data = await parseApiResponse<T>(res);

  if (res.status === 401) {
    if (token && !publicAuth) {
      clearSessionKeepPreferences();
      redirectToLogin();
    }
    throw new Error(data.message || "Yetkisiz");
  }

  if (res.status === 403) {
    throw new Error(data.message || "Bu işlem için yetkiniz yok");
  }

  return throwIfPanelApiFailed(res, data);
}

export const API = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
  download: async (path: string, filename: string): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem(LS_KEYS.token) : null;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(apiUrl(path), {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(PANEL_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (isAbortTimeout(err)) {
        throw new Error("Sunucu yanıt vermedi");
      }
      throw new Error("Sunucuya ulaşılamıyor");
    }

    if (res.status === 401) {
      if (token) {
        clearSessionKeepPreferences();
        redirectToLogin();
      }
      throw new Error("Yetkisiz");
    }

    if (!res.ok) {
      let message = "İndirme başarısız";
      try {
        const data = await parseApiResponse(res);
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
    if (!API.token()) redirectToLogin();
  },
  logout: async () => {
    const logId = localStorage.getItem(LS_KEYS.logId);
    try {
      await API.post("/cashier/logout", { log_id: logId ? Number(logId) : undefined });
    } catch {
      /* ignore */
    }
    clearSessionKeepPreferences();
    redirectToLogin();
  },
};
