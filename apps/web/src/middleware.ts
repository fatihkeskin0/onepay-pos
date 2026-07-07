import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolvePanelHost,
  resolvePanelOrigin,
  resolvePaymentHost,
  resolvePaymentOrigin,
  usesSplitPublicDomains,
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

export function middleware(request: NextRequest) {
  if (!usesSplitPublicDomains()) {
    return NextResponse.next();
  }

  const panelHost = resolvePanelHost();
  const paymentHost = resolvePaymentHost();
  const panelOrigin = resolvePanelOrigin();
  const paymentOrigin = resolvePaymentOrigin();
  const host = requestHost(request);
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/backend/") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const isPaymentHost = host === paymentHost;
  const isPanelHost = host === panelHost;

  if (isPaymentHost) {
    if (pathname.startsWith("/pay") || pathname === "/payment-home") {
      return NextResponse.next();
    }

    if (
      pathname.startsWith("/panel") ||
      pathname.startsWith("/login") ||
      pathname === "/docs"
    ) {
      const redirect = redirectToOrigin(panelOrigin, pathname, search);
      if (redirect) return redirect;
    }

    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/payment-home", request.url));
    }
  }

  if (isPanelHost && pathname.startsWith("/pay")) {
    const redirect = redirectToOrigin(paymentOrigin, pathname, search);
    if (redirect) return redirect;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
