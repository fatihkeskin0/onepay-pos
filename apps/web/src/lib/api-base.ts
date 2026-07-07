const PROXY_BASE = "/backend";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isDockerInternalApi(url: string): boolean {
  try {
    return new URL(url).hostname === "api";
  } catch {
    return false;
  }
}

/** Public API origin for browser requests (e.g. https://api.onekart.info). */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) return PROXY_BASE;

  if (typeof window !== "undefined" && isDockerInternalApi(configured)) {
    return PROXY_BASE;
  }

  return stripTrailingSlash(configured);
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base === PROXY_BASE ? `${PROXY_BASE}${normalized}` : `${base}${normalized}`;
}
