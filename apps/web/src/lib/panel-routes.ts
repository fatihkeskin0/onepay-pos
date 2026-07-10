/** Next.js App Router internal prefix (filesystem under app/panel/) */
export const PANEL_INTERNAL_PREFIX = "/panel";

/** Public URL segments served on APP_BASE_URL (e.g. app.onekart.info/dashboard) */
export const PANEL_PUBLIC_SEGMENTS = [
  "dashboard",
  "deposit",
  "transactions",
  "applications",
  "sites",
  "users",
  "cashiers",
  "monitor",
  "site-reconciliation",
  "logs",
  "login-logs",
  "reports",
  "suspicious",
  "security",
  "announcements",
  "settings",
  "demo",
  "pos",
  "proxy",
] as const;

export type PanelPublicSegment = (typeof PANEL_PUBLIC_SEGMENTS)[number];

export function isPanelPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return false;
  return (PANEL_PUBLIC_SEGMENTS as readonly string[]).includes(segment);
}

/** Public path → internal Next.js path (/dashboard → /panel/dashboard) */
export function toInternalPanelPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return `${PANEL_INTERNAL_PREFIX}/dashboard`;
  if (pathname.startsWith(`${PANEL_INTERNAL_PREFIX}/`) || pathname === PANEL_INTERNAL_PREFIX) {
    return pathname;
  }
  if (pathname === "/login") return pathname;
  if (isPanelPublicPath(pathname)) return `${PANEL_INTERNAL_PREFIX}${pathname}`;
  return pathname;
}

/** Internal or legacy path → public URL path (/panel/dashboard → /dashboard) */
export function toPublicPanelPath(pathname: string): string {
  if (pathname === "/login") return pathname;
  if (pathname === PANEL_INTERNAL_PREFIX || pathname === `${PANEL_INTERNAL_PREFIX}/`) {
    return "/login";
  }
  if (pathname.startsWith(`${PANEL_INTERNAL_PREFIX}/`)) {
    const stripped = pathname.slice(PANEL_INTERNAL_PREFIX.length);
    return stripped || "/dashboard";
  }
  if (pathname === "/login-logs" || pathname.startsWith("/login-logs/")) {
    return pathname.replace("/login-logs", "/logs");
  }
  return pathname;
}

export function panelHref(segment: PanelPublicSegment | string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return toPublicPanelPath(normalized);
}
