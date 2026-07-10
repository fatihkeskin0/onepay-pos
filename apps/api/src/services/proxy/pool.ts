import { prisma, Prisma } from "@onepara/db";
import type { ProxyProtocol } from "@onepara/shared";
import { encryptProxySecret } from "./crypto.js";
import type { ProxyImportItem } from "./types.js";

const MAX_IMPORT = 200;

export interface ProxyPoolRow {
  id: number;
  label: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  username: string | null;
  hasPassword: boolean;
  is_active: boolean;
  last_used_at: string | null;
  fail_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

let cacheExpiresAt = 0;
let cachedActiveIds: number[] = [];

function mapRow(row: {
  id: number;
  label: string;
  host: string;
  port: number;
  protocol: string;
  username: string | null;
  passwordEnc: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  failCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProxyPoolRow {
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    protocol: row.protocol === "https" ? "https" : "http",
    username: row.username,
    hasPassword: !!row.passwordEnc,
    is_active: row.isActive,
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    fail_count: row.failCount,
    last_error: row.lastError,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function invalidateProxyPoolCache(): void {
  cacheExpiresAt = 0;
  cachedActiveIds = [];
}

async function refreshActiveIds(): Promise<number[]> {
  if (Date.now() < cacheExpiresAt) return cachedActiveIds;
  const rows = await prisma.proxyPoolEntry.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  cachedActiveIds = rows.map((r) => r.id);
  cacheExpiresAt = Date.now() + 60_000;
  return cachedActiveIds;
}

export async function listProxyPoolEntries(): Promise<ProxyPoolRow[]> {
  const rows = await prisma.proxyPoolEntry.findMany({ orderBy: [{ isActive: "desc" }, { label: "asc" }] });
  return rows.map(mapRow);
}

export async function getProxyEntriesByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return prisma.proxyPoolEntry.findMany({
    where: { id: { in: ids }, isActive: true },
  });
}

export async function getAllActiveProxyEntries() {
  const ids = await refreshActiveIds();
  if (ids.length === 0) return [];
  return getProxyEntriesByIds(ids);
}

function validateImportItem(item: ProxyImportItem, index: number): ProxyImportItem {
  const label = String(item.label ?? "").trim().slice(0, 120);
  const host = String(item.host ?? "").trim().slice(0, 255);
  const port = Number(item.port);
  if (!label) throw new Error(`Satır ${index + 1}: label gerekli`);
  if (!host) throw new Error(`Satır ${index + 1}: host gerekli`);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Satır ${index + 1}: geçersiz port`);
  }
  const protocol = item.protocol === "https" ? "https" : "http";
  return {
    label,
    host,
    port,
    protocol,
    username: item.username ? String(item.username).trim().slice(0, 120) : undefined,
    password: item.password ? String(item.password) : undefined,
  };
}

export async function addProxyPoolEntry(input: ProxyImportItem): Promise<ProxyPoolRow> {
  const item = validateImportItem(input, 0);
  const row = await prisma.proxyPoolEntry.create({
    data: {
      label: item.label,
      host: item.host,
      port: item.port,
      protocol: item.protocol ?? "http",
      username: item.username ?? null,
      passwordEnc: item.password ? encryptProxySecret(item.password) : null,
    },
  });
  invalidateProxyPoolCache();
  return mapRow(row);
}

export async function importProxyPoolEntries(items: ProxyImportItem[]): Promise<{ created: number; skipped: number }> {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Boş import listesi");
  if (items.length > MAX_IMPORT) throw new Error(`En fazla ${MAX_IMPORT} kayıt import edilebilir`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    if (!raw) continue;
    const item = validateImportItem(raw, i);
    try {
      await prisma.proxyPoolEntry.create({
        data: {
          label: item.label,
          host: item.host,
          port: item.port,
          protocol: item.protocol ?? "http",
          username: item.username ?? null,
          passwordEnc: item.password ? encryptProxySecret(item.password) : null,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  invalidateProxyPoolCache();
  return { created, skipped };
}

export async function updateProxyPoolEntry(
  id: number,
  input: Partial<{
    label: string;
    is_active: boolean;
    protocol: ProxyProtocol;
    username: string | null;
    password: string | null;
    clear_password: boolean;
  }>,
): Promise<ProxyPoolRow> {
  const data: Record<string, unknown> = {};
  if (input.label != null) data.label = input.label.trim().slice(0, 120);
  if (input.is_active != null) data.isActive = input.is_active;
  if (input.protocol != null) data.protocol = input.protocol;
  if (input.username !== undefined) data.username = input.username;
  if (input.clear_password) data.passwordEnc = null;
  else if (input.password) data.passwordEnc = encryptProxySecret(input.password);

  const row = await prisma.proxyPoolEntry.update({ where: { id }, data });
  invalidateProxyPoolCache();
  return mapRow(row);
}

export async function deleteProxyPoolEntry(id: number): Promise<void> {
  await prisma.proxyPoolEntry.delete({ where: { id } });

  const methods = await prisma.posMethod.findMany({
    where: { NOT: { proxyEntryIds: { equals: Prisma.DbNull } } },
    select: { id: true, proxyEntryIds: true },
  });

  for (const m of methods) {
    const ids = Array.isArray(m.proxyEntryIds) ? (m.proxyEntryIds as number[]) : [];
    const next = ids.filter((x) => x !== id);
    if (next.length !== ids.length) {
      await prisma.posMethod.update({
        where: { id: m.id },
        data: { proxyEntryIds: next.length ? next : Prisma.JsonNull },
      });
    }
  }

  invalidateProxyPoolCache();
}

export async function recordProxySuccess(id: number): Promise<void> {
  try {
    await prisma.proxyPoolEntry.update({
      where: { id },
      data: { lastUsedAt: new Date(), failCount: 0, lastError: null },
    });
  } catch {
    /* ignore */
  }
}

export async function recordProxyFailure(id: number, message: string): Promise<void> {
  try {
    await prisma.proxyPoolEntry.update({
      where: { id },
      data: {
        failCount: { increment: 1 },
        lastError: message.slice(0, 500),
      },
    });
  } catch {
    /* ignore */
  }
}
