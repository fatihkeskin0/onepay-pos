function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const DEV_API_FALLBACK = "http://localhost:4105";

/** Public API origin for browser requests (e.g. https://api.onekart.info). */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return stripTrailingSlash(configured);
  return DEV_API_FALLBACK;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}
