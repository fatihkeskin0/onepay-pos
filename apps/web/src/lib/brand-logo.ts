import { getApiBaseUrl } from "@/lib/api-base";

/** Resolve site logo path for browser display (payment page, admin preview). */
export function resolveBrandLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }

  const path = url.startsWith("/") ? url : `/${url}`;
  return `${getApiBaseUrl()}${path}`;
}
