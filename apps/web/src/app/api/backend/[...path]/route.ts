import { NextRequest, NextResponse } from "next/server";
import { resolveApiInternalUrl } from "@/lib/api-internal-url";

const FORWARD_HEADERS = ["content-type", "x-api-key", "x-apikey"];

function buildUpstreamUrl(path: string[], search: string): string {
  const base = resolveApiInternalUrl();
  const joined = path.join("/");
  const qs = search ? `?${search}` : "";
  return `${base}/${joined}${qs}`;
}

async function proxyRequest(request: NextRequest, path: string[]): Promise<NextResponse> {
  const url = buildUpstreamUrl(path, request.nextUrl.searchParams.toString());
  const headers = new Headers();
  for (const key of FORWARD_HEADERS) {
    const val = request.headers.get(key);
    if (val) headers.set(key, val);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(url, init);
    const body = await upstream.text();
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "API sunucusuna ulaşılamıyor",
        data: null,
        code: "UPSTREAM_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}
