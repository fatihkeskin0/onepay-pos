import { API_ROUTE_PREFIX } from "@onepara/shared";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const DEV_API_FALLBACK = "http://localhost:4105";

declare global {
  interface Window {
    __ONEPOS_API__?: string;
  }
}

function readEnvApiUrl(): string {
  const apiPublic = process.env.API_PUBLIC_URL?.trim();
  if (apiPublic) return apiPublic;
  const nextPublic = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (nextPublic) return nextPublic;
  return "";
}

/** Public API origin for browser requests (e.g. https://api.onekart.info). */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__ONEPOS_API__?.trim();
    if (runtime) return stripTrailingSlash(runtime);
  }
  const configured = readEnvApiUrl();
  if (configured) return stripTrailingSlash(configured);
  return DEV_API_FALLBACK;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const versioned = normalized.startsWith(`${API_ROUTE_PREFIX}/`)
    ? normalized
    : `${API_ROUTE_PREFIX}${normalized}`;
  return `${getApiBaseUrl()}${versioned}`;
}

/** Same-origin proxy for pay page — avoids cross-origin CORS on odeme.click. */
export function payApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const versioned = normalized.startsWith(`${API_ROUTE_PREFIX}/`)
    ? normalized
    : `${API_ROUTE_PREFIX}${normalized}`;
  return `/api/backend${versioned}`;
}
