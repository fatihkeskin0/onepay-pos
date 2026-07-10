import type { PspProviderName, ProxyMode } from "@onepara/shared";
import { prisma } from "@onepara/db";
import { decryptProxySecret } from "./crypto.js";
import { getAllActiveProxyEntries, getProxyEntriesByIds } from "./pool.js";
import type { ProxyRuntimeEntry } from "./types.js";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function toRuntime(row: {
  id: number;
  label: string;
  host: string;
  port: number;
  protocol: string;
  username: string | null;
  passwordEnc: string | null;
}): ProxyRuntimeEntry {
  let password: string | null = null;
  if (row.passwordEnc) {
    try {
      password = decryptProxySecret(row.passwordEnc);
    } catch {
      password = null;
    }
  }
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    protocol: row.protocol === "https" ? "https" : "http",
    username: row.username,
    password,
  };
}

export async function resolveProxyCandidates(provider: PspProviderName): Promise<ProxyRuntimeEntry[]> {
  const method = await prisma.posMethod.findUnique({ where: { provider } });
  if (!method?.proxyEnabled) return [];

  const mode = (method.proxyMode ?? "off") as ProxyMode;
  if (mode === "off") return [];

  let rows;
  if (mode === "pool_selected") {
    const ids = Array.isArray(method.proxyEntryIds) ? (method.proxyEntryIds as number[]) : [];
    if (ids.length === 0) return [];
    rows = await getProxyEntriesByIds(ids);
  } else {
    rows = await getAllActiveProxyEntries();
  }

  return shuffle(rows.map(toRuntime));
}
