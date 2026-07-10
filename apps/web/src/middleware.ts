import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPanelPublicPath,
  PANEL_INTERNAL_PREFIX,
  toInternalPanelPath,
  toPublicPanelPath,
} from "@/lib/panel-routes";
import { internalApiUrl } from "@/lib/api-internal-url";
import {
  isMarketingRequestHost,
  isPanelRequestHost,
  resolveMarketingOrigin,
  resolvePanelOrigin,
  resolvePaymentHost,
  resolvePaymentOrigin,
  usesMarketingDomain,
} from "@/lib/public-urls";

function requestHost(request: NextRequest): string {
  return (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

function redirectToOrigin(origin: string | null, pathname: string, search: string): NextResponse | null {
  if (!origin) return null;
  try {
    const target = new URL(`${pathname}${search}`, origin);
    return NextResponse.redirect(target);
  } catch {
    return null;
  }
}

function redirectOnSameHost(request: NextRequest, pathname: string, search: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

function rewriteToInternal(request: NextRequest, pathname: string): NextResponse {
  const internal = toInternalPanelPath(pathname);
  const url = request.nextUrl.clone();
  url.pathname = internal;
  return NextResponse.rewrite(url);
}

function redirectPanelToApp(
  panelOrigin: string | null,
  pathname: string,
  search: string,
): NextResponse | null {
  const publicPath = toPublicPanelPath(pathname);
  return redirectToOrigin(panelOrigin, publicPath, search);
}

function isExclusivePaymentHost(
  host: string,
  onMarketingHost: boolean,
  onPanelHost: boolean,
  paymentHost: string | null,
): boolean {
  if (!paymentHost || host !== paymentHost) return false;
  if (onMarketingHost) return false;
  if (onPanelHost) return false;
  return true;
}

function isMarketingContentPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/docs" || pathname.startsWith("/docs/");
}

function middlewareClientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "127.0.0.1";
  return "127.0.0.1";
}

function isPanelAccessGuardedPath(pathname: string): boolean {
  if (pathname === "/access-denied") return false;
  if (pathname === "/login") return true;
  return isPanelPublicPath(pathname);
}

async function isPanelAccessBlocked(request: NextRequest): Promise<boolean> {
  const ip = middlewareClientIp(request);
  try {
    const res = await fetch(internalApiUrl(`/public/panel_access?ip=${encodeURIComponent(ip)}`), {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: boolean; data?: { enabled?: boolean; allowed?: boolean } };
    const data = body.data;
    return data?.enabled === true && data?.allowed === false;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const paymentHost = resolvePaymentHost();
  const panelOrigin = resolvePanelOrigin();
  const marketingOrigin = resolveMarketingOrigin();
  const paymentOrigin = resolvePaymentOrigin();
  const host = requestHost(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const onPanelHost = isPanelRequestHost(host);
  const marketingSplit = usesMarketingDomain();
  const panelGuarded =
    onPanelHost || (!marketingSplit && isPanelAccessGuardedPath(pathname));

  if (panelGuarded && isPanelAccessGuardedPath(pathname)) {
    if (await isPanelAccessBlocked(request)) {
      return redirectOnSameHost(request, "/access-denied", "");
    }
  }

  const onMarketingHost = isMarketingRequestHost(host);
  const isLegacyPanelPath =
    pathname === PANEL_INTERNAL_PREFIX || pathname.startsWith(`${PANEL_INTERNAL_PREFIX}/`);

  // Legacy /panel/* — marketing → app.* ; panel host → strip prefix
  if (isLegacyPanelPath) {
    if (onMarketingHost) {
      const redirect = redirectPanelToApp(panelOrigin, pathname, search);
      if (redirect) return redirect;
    }
    return redirectOnSameHost(request, toPublicPanelPath(pathname), search);
  }

  const exclusivePayment = isExclusivePaymentHost(host, onMarketingHost, onPanelHost, paymentHost);

  // Dedicated payment domain (e.g. odeme.click)
  if (exclusivePayment) {
    if (pathname.startsWith("/pay") || pathname === "/payment-home") {
      return NextResponse.next();
    }
    if (isPanelPublicPath(pathname)) {
      const redirect = redirectPanelToApp(panelOrigin, pathname, search);
      if (redirect) return redirect;
    }
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/payment-home", request.url));
    }
  }

  // Panel subdomain only — login, dashboard, etc.
  if (onPanelHost) {
    if (pathname === "/") {
      return redirectOnSameHost(request, "/login", search);
    }
    if (pathname.startsWith("/pay")) {
      const redirect = redirectToOrigin(paymentOrigin, pathname, search);
      if (redirect) return redirect;
    }
    if (pathname === "/docs" || pathname.startsWith("/docs/")) {
      const redirect = redirectToOrigin(marketingOrigin, pathname, search);
      if (redirect) return redirect;
    }
    if (isPanelPublicPath(pathname)) {
      return rewriteToInternal(request, pathname);
    }
    return redirectOnSameHost(request, "/login", search);
  }

  // Marketing domain — ONLY landing + docs (+ pay on shared localhost)
  if (onMarketingHost) {
    if (pathname.startsWith("/pay") || pathname === "/payment-home") {
      return NextResponse.next();
    }
    if (isPanelPublicPath(pathname)) {
      const redirect = redirectPanelToApp(panelOrigin, pathname, search);
      if (redirect) return redirect;
    }
    if (isMarketingContentPath(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // Single-host fallback when marketing/app split not configured
  if (!marketingSplit) {
    if (pathname === "/") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/pay") || pathname === "/payment-home") {
      return NextResponse.next();
    }
    if (isPanelPublicPath(pathname)) {
      return rewriteToInternal(request, pathname);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
