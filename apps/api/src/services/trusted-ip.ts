import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { prisma, Prisma } from "@onepara/db";
import { config } from "../config.js";
import { ipMatchesCidr, normalizeCidr } from "./ip-match.js";
import { syncTrustedIpsToCloudflare } from "./cloudflare-access.js";

export interface TrustedIpRow {
  id: number;
  cidr: string;
  label: string;
  category: string;
  skip_rate_limit: boolean;
  sync_cloudflare: boolean;
  cloudflare_rule_ids: Record<string, string> | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

let cacheExpiresAt = 0;
let cachedEntries: Array<{ cidr: string; skipRateLimit: boolean }> = [];

function mapRow(row: {
  id: number;
  cidr: string;
  label: string;
  category: string;
  skipRateLimit: boolean;
  syncCloudflare: boolean;
  cloudflareRuleIds: unknown;
  isActive: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TrustedIpRow {
  const ruleIds = row.cloudflareRuleIds;
  return {
    id: row.id,
    cidr: row.cidr,
    label: row.label,
    category: row.category,
    skip_rate_limit: row.skipRateLimit,
    sync_cloudflare: row.syncCloudflare,
    cloudflare_rule_ids:
      ruleIds && typeof ruleIds === "object" && !Array.isArray(ruleIds)
        ? (ruleIds as Record<string, string>)
        : null,
    is_active: row.isActive,
    note: row.note,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function invalidateTrustedIpCache(): void {
  cacheExpiresAt = 0;
  cachedEntries = [];
}

async function refreshCache(): Promise<void> {
  if (Date.now() < cacheExpiresAt) return;

  const rows = await prisma.trustedIp.findMany({
    where: { isActive: true },
    select: { cidr: true, skipRateLimit: true },
  });

  cachedEntries = rows;
  cacheExpiresAt = Date.now() + 60_000;
}

export async function shouldSkipRateLimit(clientIp: string): Promise<boolean> {
  await refreshCache();
  return cachedEntries.some((entry) => entry.skipRateLimit && ipMatchesCidr(clientIp, entry.cidr));
}

export async function listTrustedIps(): Promise<TrustedIpRow[]> {
  const rows = await prisma.trustedIp.findMany({ orderBy: [{ isActive: "desc" }, { label: "asc" }] });
  return rows.map(mapRow);
}

export async function addTrustedIp(input: {
  cidr: string;
  label: string;
  category?: string;
  skip_rate_limit?: boolean;
  sync_cloudflare?: boolean;
  note?: string;
}): Promise<TrustedIpRow> {
  const cidr = normalizeCidr(input.cidr);
  if (!cidr) throw new Error("Geçersiz IP veya CIDR");

  const label = input.label.trim().slice(0, 120);
  if (!label) throw new Error("Etiket gerekli");

  const row = await prisma.trustedIp.create({
    data: {
      cidr,
      label,
      category: (input.category ?? "betconstruct").trim().slice(0, 30) || "betconstruct",
      skipRateLimit: input.skip_rate_limit !== false,
      syncCloudflare: input.sync_cloudflare !== false,
      note: input.note?.trim().slice(0, 500) || null,
    },
  });

  invalidateTrustedIpCache();
  return mapRow(row);
}

export async function updateTrustedIp(
  id: number,
  input: {
    cidr?: string;
    label?: string;
    category?: string;
    skip_rate_limit?: boolean;
    sync_cloudflare?: boolean;
    is_active?: boolean;
    note?: string;
  },
): Promise<TrustedIpRow> {
  const existing = await prisma.trustedIp.findUnique({ where: { id } });
  if (!existing) throw new Error("Kayıt bulunamadı");

  const data: {
    cidr?: string;
    label?: string;
    category?: string;
    skipRateLimit?: boolean;
    syncCloudflare?: boolean;
    isActive?: boolean;
    note?: string | null;
    cloudflareRuleIds?: typeof Prisma.DbNull;
  } = {};

  if (input.cidr !== undefined) {
    const cidr = normalizeCidr(input.cidr);
    if (!cidr) throw new Error("Geçersiz IP veya CIDR");
    data.cidr = cidr;
    if (cidr !== existing.cidr) data.cloudflareRuleIds = Prisma.DbNull;
  }
  if (input.label !== undefined) {
    const label = input.label.trim().slice(0, 120);
    if (!label) throw new Error("Etiket gerekli");
    data.label = label;
  }
  if (input.category !== undefined) {
    data.category = input.category.trim().slice(0, 30) || "betconstruct";
  }
  if (input.skip_rate_limit !== undefined) data.skipRateLimit = input.skip_rate_limit;
  if (input.sync_cloudflare !== undefined) data.syncCloudflare = input.sync_cloudflare;
  if (input.is_active !== undefined) data.isActive = input.is_active;
  if (input.note !== undefined) data.note = input.note.trim().slice(0, 500) || null;

  const row = await prisma.trustedIp.update({ where: { id }, data });
  invalidateTrustedIpCache();
  return mapRow(row);
}

export async function deleteTrustedIp(id: number): Promise<void> {
  const row = await prisma.trustedIp.findUnique({ where: { id } });
  if (!row) throw new Error("Kayıt bulunamadı");

  if (row.cloudflareRuleIds) {
    await syncTrustedIpsToCloudflare([{ ...row, isActive: false, syncCloudflare: true }]);
  }

  await prisma.trustedIp.delete({ where: { id } });
  invalidateTrustedIpCache();
}

export async function exportFail2banIgnoreFile(): Promise<{ path: string; count: number } | null> {
  const target = config.security.fail2banIgnoreFile.trim();
  if (!target) return null;

  const rows = await prisma.trustedIp.findMany({
    where: { isActive: true },
    orderBy: { cidr: "asc" },
  });

  const lines = [
    "# Generated by OnePOS — do not edit manually",
    `# updated_at: ${new Date().toISOString()}`,
    "[DEFAULT]",
    `ignoreip = 127.0.0.1/8 ::1 ${rows.map((r) => r.cidr).join(" ")}`.trim(),
    "",
  ];

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, lines.join("\n"), "utf8");
  return { path: target, count: rows.length };
}

export interface TrustedIpSyncResult {
  cloudflare: { synced: number; errors: string[] };
  fail2ban: { path: string | null; count: number; error: string | null };
}

export async function syncTrustedIpIntegrations(): Promise<TrustedIpSyncResult> {
  const rows = await prisma.trustedIp.findMany({ orderBy: { id: "asc" } });
  const cloudflare = await syncTrustedIpsToCloudflare(rows);

  let fail2ban: TrustedIpSyncResult["fail2ban"] = {
    path: null,
    count: 0,
    error: null,
  };

  try {
    const exported = await exportFail2banIgnoreFile();
    if (exported) {
      fail2ban = { path: exported.path, count: exported.count, error: null };
    }
  } catch (err) {
    fail2ban.error = err instanceof Error ? err.message : "fail2ban export failed";
  }

  return { cloudflare, fail2ban };
}
