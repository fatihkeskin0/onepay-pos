/** Resolve site logo path for browser display (payment page, admin preview). */
export function resolveBrandLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("/backend/")) return url;
  if (url.startsWith("/uploads/")) return `/backend${url}`;
  return url;
}
