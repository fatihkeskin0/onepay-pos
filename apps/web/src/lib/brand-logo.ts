import { getApiBaseUrl } from "@/lib/api-base";

/** Resolve site logo path for browser display (payment page, admin preview). */
export function resolveBrandLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }

  const base = getApiBaseUrl();
  const path = url.startsWith("/backend/")
    ? url.replace(/^\/backend/, "")
    : url.startsWith("/uploads/")
      ? url
      : url;

  if (base === "/backend") {
    if (url.startsWith("/backend/")) return url;
    if (url.startsWith("/uploads/")) return `/backend${url}`;
    return url;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
