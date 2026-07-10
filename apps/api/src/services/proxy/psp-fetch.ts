import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { PspProviderName } from "@onepara/shared";
import { recordProxyFailure, recordProxySuccess } from "./pool.js";
import { resolveProxyCandidates } from "./selector.js";
import type { ProxyRuntimeEntry } from "./types.js";

const PSP_FETCH_TIMEOUT_MS = 30_000;

export class PspProxyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PspProxyError";
  }
}

function buildProxyUrl(entry: ProxyRuntimeEntry): string {
  const auth =
    entry.username && entry.password
      ? `${encodeURIComponent(entry.username)}:${encodeURIComponent(entry.password)}@`
      : entry.username
        ? `${encodeURIComponent(entry.username)}@`
        : "";
  return `${entry.protocol}://${auth}${entry.host}:${entry.port}`;
}

async function fetchDirect(url: string | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSP_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaProxy(
  url: string | URL,
  init: RequestInit | undefined,
  entry: ProxyRuntimeEntry,
): Promise<Response> {
  const proxyUrl = buildProxyUrl(entry);
  const dispatcher = new ProxyAgent(proxyUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSP_FETCH_TIMEOUT_MS);

  try {
    const res = await undiciFetch(url, {
      method: init?.method,
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body as string | undefined,
      signal: controller.signal,
      dispatcher,
    });
    return res as unknown as Response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchForProvider(
  provider: PspProviderName,
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const candidates = await resolveProxyCandidates(provider);
  if (candidates.length === 0) {
    return fetchDirect(url, init);
  }

  let lastError = "Proxy bağlantısı başarısız";

  for (const entry of candidates) {
    try {
      const res = await fetchViaProxy(url, init, entry);
      if (res.ok || res.status < 500) {
        await recordProxySuccess(entry.id);
        return res;
      }
      lastError = `HTTP ${res.status}`;
      await recordProxyFailure(entry.id, lastError);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Proxy hatası";
      await recordProxyFailure(entry.id, lastError);
    }
  }

  throw new PspProxyError(`Tüm proxyler başarısız: ${lastError}`);
}
