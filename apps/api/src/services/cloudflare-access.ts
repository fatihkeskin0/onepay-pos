import { config } from "../config.js";
import type { TrustedIp } from "@onepara/db";
import { Prisma } from "@onepara/db";

const CF_BASE = "https://api.cloudflare.com/client/v4";

interface CfApiResult<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

interface CfAccessRule {
  id: string;
}

function cfHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.cloudflare.apiToken}`,
    "Content-Type": "application/json",
  };
}

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: { ...cfHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const body = (await res.json()) as CfApiResult<T>;
  if (!body.success) {
    const msg = body.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(msg || "Cloudflare API error");
  }
  return body.result;
}

function parseRuleIds(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

function accessConfiguration(cidr: string): { target: string; value: string } {
  return {
    target: cidr.includes("/") ? "ip_range" : "ip",
    value: cidr,
  };
}

async function deleteAccessRule(zoneId: string, ruleId: string): Promise<void> {
  try {
    await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`, { method: "DELETE" });
  } catch {
    /* rule may already be gone */
  }
}

async function upsertAccessRule(
  zoneId: string,
  cidr: string,
  notes: string,
  existingRuleId?: string,
): Promise<string> {
  const payload = {
    mode: "allow",
    notes,
    configuration: accessConfiguration(cidr),
  };

  if (existingRuleId) {
    await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules/${existingRuleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return existingRuleId;
  }

  const created = await cfFetch<CfAccessRule>(`/zones/${zoneId}/firewall/access_rules/rules`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return created.id;
}

export async function syncTrustedIpsToCloudflare(
  rows: TrustedIp[],
): Promise<{ synced: number; errors: string[] }> {
  const result = { synced: 0, errors: [] as string[] };

  if (!config.cloudflare.apiToken.trim() || config.cloudflare.zones.length === 0) {
    result.errors.push("Cloudflare yapılandırılmamış");
    return result;
  }

  const { prisma } = await import("@onepara/db");

  for (const row of rows) {
    const existingRuleIds = parseRuleIds(row.cloudflareRuleIds);
    const nextRuleIds: Record<string, string> = { ...existingRuleIds };

    if (!row.isActive || !row.syncCloudflare) {
      for (const [zoneId, ruleId] of Object.entries(existingRuleIds)) {
        try {
          await deleteAccessRule(zoneId, ruleId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "delete failed";
          result.errors.push(`${row.cidr}@${zoneId}: ${msg}`);
        }
      }
      await prisma.trustedIp.update({
        where: { id: row.id },
        data: { cloudflareRuleIds: Prisma.DbNull },
      });
      continue;
    }

    for (const zone of config.cloudflare.zones) {
      try {
        const ruleId = await upsertAccessRule(
          zone.id,
          row.cidr,
          `OnePOS trusted: ${row.label}`,
          existingRuleIds[zone.id],
        );
        nextRuleIds[zone.id] = ruleId;
        result.synced += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "sync failed";
        result.errors.push(`${row.cidr}@${zone.domain}: ${msg}`);
      }
    }

    for (const [zoneId, ruleId] of Object.entries(existingRuleIds)) {
      if (!config.cloudflare.zones.some((z) => z.id === zoneId)) {
        try {
          await deleteAccessRule(zoneId, ruleId);
        } catch {
          /* ignore */
        }
        delete nextRuleIds[zoneId];
      }
    }

    const ruleData =
      Object.keys(nextRuleIds).length > 0
        ? { cloudflareRuleIds: nextRuleIds as Prisma.InputJsonValue }
        : { cloudflareRuleIds: Prisma.DbNull };

    await prisma.trustedIp.update({
      where: { id: row.id },
      data: ruleData,
    });
  }

  return result;
}
