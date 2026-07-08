import { config } from "../config.js";

const CF_BASE = "https://api.cloudflare.com/client/v4";

interface CfApiResult<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
}

interface CfZoneSetting {
  value: string | number | boolean;
}

export interface CloudflareZoneConfig {
  id: string;
  domain: string;
}

interface ExpectedDnsRecord {
  hostname: string;
  recordName: string;
  zone: CloudflareZoneConfig;
}

export interface DnsRecordStatus {
  hostname: string;
  recordName: string;
  exists: boolean;
  type?: string;
  content?: string;
  proxied?: boolean;
  matchesOrigin: boolean;
  proxiedOk: boolean;
}

export interface ZoneStatus {
  id: string;
  domain: string;
  sslMode: string | null;
  sslOk: boolean;
  alwaysHttps: boolean | null;
  alwaysHttpsOk: boolean;
  records: DnsRecordStatus[];
}

export interface CloudflareStatus {
  configured: boolean;
  tokenValid: boolean;
  originIp: string;
  autoSync: boolean;
  zones: ZoneStatus[];
  errors: string[];
}

export interface SyncResult {
  dns: { created: number; updated: number; skipped: number; errors: string[] };
  ssl: { updated: number; errors: string[] };
}

function cfHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.cloudflare.apiToken}`,
    "Content-Type": "application/json",
  };
}

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
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
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Cloudflare API request failed");
  }
}

export function isCloudflareConfigured(): boolean {
  return Boolean(
    config.cloudflare.apiToken.trim() &&
      config.cloudflare.originIp.trim() &&
      config.cloudflare.zones.length > 0,
  );
}

function parsePublicHostname(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1") return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

function findZoneForHostname(hostname: string): CloudflareZoneConfig | null {
  for (const zone of config.cloudflare.zones) {
    const domain = zone.domain.toLowerCase();
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return zone;
  }
  return null;
}

function hostnameToRecordName(hostname: string, zoneDomain: string): string {
  const host = hostname.toLowerCase();
  const domain = zoneDomain.toLowerCase();
  if (host === domain) return "@";
  if (host.endsWith(`.${domain}`)) return host.slice(0, -(domain.length + 1));
  return hostname;
}

function getExpectedRecords(): ExpectedDnsRecord[] {
  const urls = [
    config.app.marketingUrl,
    config.app.baseUrl,
    config.app.paymentUrl,
    config.api.publicUrl,
  ];
  const seen = new Set<string>();
  const records: ExpectedDnsRecord[] = [];

  for (const url of urls) {
    const hostname = parsePublicHostname(url);
    if (!hostname || seen.has(hostname)) continue;
    seen.add(hostname);
    const zone = findZoneForHostname(hostname);
    if (!zone) continue;
    records.push({
      hostname,
      recordName: hostnameToRecordName(hostname, zone.domain),
      zone,
    });
  }
  return records;
}

function recordsByZone(): Map<string, { zone: CloudflareZoneConfig; records: ExpectedDnsRecord[] }> {
  const map = new Map<string, { zone: CloudflareZoneConfig; records: ExpectedDnsRecord[] }>();
  for (const rec of getExpectedRecords()) {
    const entry = map.get(rec.zone.id) ?? { zone: rec.zone, records: [] };
    entry.records.push(rec);
    map.set(rec.zone.id, entry);
  }
  for (const zone of config.cloudflare.zones) {
    if (!map.has(zone.id)) map.set(zone.id, { zone, records: [] });
  }
  return map;
}

async function listDnsRecords(zoneId: string, hostname: string): Promise<CfDnsRecord[]> {
  const result = await cfFetch<CfDnsRecord[]>(
    `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(hostname)}`,
  );
  const cname = await cfFetch<CfDnsRecord[]>(
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
  );
  return [...result, ...cname];
}

function recordMatchesOrigin(record: CfDnsRecord, originIp: string): boolean {
  if (record.type === "A") return record.content === originIp;
  return false;
}

async function readZoneSetting(zoneId: string, setting: string): Promise<string | null> {
  try {
    const result = await cfFetch<CfZoneSetting>(`/zones/${zoneId}/settings/${setting}`);
    return String(result.value);
  } catch {
    return null;
  }
}

export async function verifyCloudflareToken(): Promise<boolean> {
  if (!config.cloudflare.apiToken.trim()) return false;
  try {
    await cfFetch<{ status: string }>("/user/tokens/verify");
    return true;
  } catch {
    return false;
  }
}

export async function getCloudflareStatus(): Promise<CloudflareStatus> {
  const status: CloudflareStatus = {
    configured: isCloudflareConfigured(),
    tokenValid: false,
    originIp: config.cloudflare.originIp,
    autoSync: config.cloudflare.autoSync,
    zones: [],
    errors: [],
  };

  if (!config.cloudflare.apiToken.trim()) {
    status.errors.push("CLOUDFLARE_API_TOKEN is not set");
    return status;
  }

  status.tokenValid = await verifyCloudflareToken();
  if (!status.tokenValid) {
    status.errors.push("Cloudflare API token is invalid or expired");
    return status;
  }

  if (!config.cloudflare.originIp.trim()) {
    status.errors.push("CLOUDFLARE_ORIGIN_IP is not set");
  }

  const originIp = config.cloudflare.originIp.trim();
  const grouped = recordsByZone();

  for (const { zone, records } of grouped.values()) {
    const sslMode = await readZoneSetting(zone.id, "ssl");
    const alwaysRaw = await readZoneSetting(zone.id, "always_use_https");
    const alwaysOn = alwaysRaw === "on";

    const zoneStatus: ZoneStatus = {
      id: zone.id,
      domain: zone.domain,
      sslMode,
      sslOk: sslMode === "strict",
      alwaysHttps: alwaysRaw === null ? null : alwaysOn,
      alwaysHttpsOk: alwaysOn,
      records: [],
    };

    for (const expected of records) {
      try {
        const existing = await listDnsRecords(zone.id, expected.hostname);
        const primary = existing.find((r) => r.type === "A") ?? existing[0];
        if (!primary) {
          zoneStatus.records.push({
            hostname: expected.hostname,
            recordName: expected.recordName,
            exists: false,
            matchesOrigin: false,
            proxiedOk: false,
          });
          continue;
        }
        zoneStatus.records.push({
          hostname: expected.hostname,
          recordName: expected.recordName,
          exists: true,
          type: primary.type,
          content: primary.content,
          proxied: primary.proxied ?? false,
          matchesOrigin: originIp ? recordMatchesOrigin(primary, originIp) : false,
          proxiedOk: primary.proxied === true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "DNS lookup failed";
        status.errors.push(`${expected.hostname}: ${msg}`);
      }
    }

    status.zones.push(zoneStatus);
  }

  return status;
}

async function upsertDnsRecord(
  zone: CloudflareZoneConfig,
  record: ExpectedDnsRecord,
  originIp: string,
): Promise<"created" | "updated" | "skipped"> {
  const existing = await listDnsRecords(zone.id, record.hostname);
  const primary = existing.find((r) => r.type === "A");

  if (primary) {
    const ok =
      primary.content === originIp && primary.proxied === true && primary.type === "A";
    if (ok) return "skipped";

    await cfFetch<CfDnsRecord>(`/zones/${zone.id}/dns_records/${primary.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        type: "A",
        name: record.recordName,
        content: originIp,
        proxied: true,
        ttl: 1,
      }),
    });
    return "updated";
  }

  await cfFetch<CfDnsRecord>(`/zones/${zone.id}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: "A",
      name: record.recordName,
      content: originIp,
      proxied: true,
      ttl: 1,
    }),
  });
  return "created";
}

async function syncDnsRecords(): Promise<SyncResult["dns"]> {
  const result: SyncResult["dns"] = { created: 0, updated: 0, skipped: 0, errors: [] };
  const originIp = config.cloudflare.originIp.trim();
  if (!originIp) {
    result.errors.push("CLOUDFLARE_ORIGIN_IP is not set");
    return result;
  }

  for (const record of getExpectedRecords()) {
    try {
      const action = await upsertDnsRecord(record.zone, record, originIp);
      result[action] += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DNS sync failed";
      result.errors.push(`${record.hostname}: ${msg}`);
    }
  }

  return result;
}

async function syncSslSettings(): Promise<SyncResult["ssl"]> {
  const result: SyncResult["ssl"] = { updated: 0, errors: [] };

  for (const zone of config.cloudflare.zones) {
    try {
      const sslMode = await readZoneSetting(zone.id, "ssl");
      if (sslMode !== "strict") {
        await cfFetch(`/zones/${zone.id}/settings/ssl`, {
          method: "PATCH",
          body: JSON.stringify({ value: "strict" }),
        });
        result.updated += 1;
      }

      const alwaysRaw = await readZoneSetting(zone.id, "always_use_https");
      if (alwaysRaw !== "on") {
        await cfFetch(`/zones/${zone.id}/settings/always_use_https`, {
          method: "PATCH",
          body: JSON.stringify({ value: "on" }),
        });
        result.updated += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SSL sync failed";
      result.errors.push(`${zone.domain}: ${msg}`);
    }
  }

  return result;
}

export async function syncCloudflare(options: {
  dns?: boolean;
  ssl?: boolean;
}): Promise<SyncResult> {
  if (!isCloudflareConfigured()) {
    throw new Error("Cloudflare is not configured (token, origin IP, zone IDs required)");
  }

  const tokenOk = await verifyCloudflareToken();
  if (!tokenOk) {
    throw new Error("Cloudflare API token is invalid");
  }

  const syncDns = options.dns !== false;
  const syncSsl = options.ssl !== false;

  const result: SyncResult = {
    dns: { created: 0, updated: 0, skipped: 0, errors: [] },
    ssl: { updated: 0, errors: [] },
  };

  if (syncDns) result.dns = await syncDnsRecords();
  if (syncSsl) result.ssl = await syncSslSettings();

  return result;
}

export async function runCloudflareAutoSync(): Promise<void> {
  if (!config.cloudflare.autoSync || !isCloudflareConfigured()) return;

  try {
    const result = await syncCloudflare({ dns: true, ssl: true });
    console.log(
      `[cloudflare] auto-sync: dns +${result.dns.created} ~${result.dns.updated} =${result.dns.skipped}, ssl ~${result.ssl.updated}`,
    );
    if (result.dns.errors.length > 0 || result.ssl.errors.length > 0) {
      console.warn("[cloudflare] auto-sync errors:", [...result.dns.errors, ...result.ssl.errors]);
    }
  } catch (err) {
    console.error("[cloudflare] auto-sync failed:", err instanceof Error ? err.message : err);
  }
}
