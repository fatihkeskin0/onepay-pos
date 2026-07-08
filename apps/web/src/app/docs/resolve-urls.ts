import { getApiBaseUrl } from "@/lib/api-base";
import type { DocsContent } from "./types";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveString(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

function deepResolve<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === "string") {
    return resolveString(value, vars) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepResolve(item, vars)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = deepResolve(item, vars);
    }
    return out as T;
  }
  return value;
}

export function resolveDocsContent(template: DocsContent): DocsContent {
  const apiPublicUrl = getApiBaseUrl();
  const paymentUrl = stripTrailingSlash(
    process.env.APP_PAYMENT_URL?.trim() || "https://odeme.click",
  );

  return deepResolve(template, {
    API_PUBLIC_URL: apiPublicUrl,
    APP_PAYMENT_URL: paymentUrl,
    payment_origin: paymentUrl,
  });
}
