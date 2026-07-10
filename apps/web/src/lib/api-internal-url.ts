import { API_ROUTE_PREFIX } from "@onepara/shared";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Server-side API origin for middleware / SSR (Docker: http://api:80). */
export function getInternalApiUrl(): string {
  const internal = process.env.API_INTERNAL_URL?.trim();
  if (internal) return stripTrailingSlash(internal);
  const pub = process.env.API_PUBLIC_URL?.trim();
  if (pub) return stripTrailingSlash(pub);
  return "http://localhost:4105";
}

export function internalApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const versioned = normalized.startsWith(`${API_ROUTE_PREFIX}/`)
    ? normalized
    : `${API_ROUTE_PREFIX}${normalized}`;
  return `${getInternalApiUrl()}${versioned}`;
}
