import { prisma } from "@onepara/db";
import { getSetting, invalidateSettingCache } from "../callback.js";
import { ipMatchesCidr, normalizeCidr } from "../ip-match.js";

export const PANEL_ACCESS_SETTING_KEY = "panel_access_whitelist_enabled";

export interface PanelAccessIpRow {
  id: number;
  cidr: string;
  label: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

let cacheExpiresAt = 0;
let cachedEntries: Array<{ cidr: string }> = [];

function mapRow(row: {
  id: number;
  cidr: string;
  label: string;
  note: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PanelAccessIpRow {
  return {
    id: row.id,
    cidr: row.cidr,
    label: row.label,
    note: row.note,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function invalidatePanelAccessCache(): void {
  cacheExpiresAt = 0;
  cachedEntries = [];
}

export async function isPanelAccessEnabled(): Promise<boolean> {
  const value = await getSetting(PANEL_ACCESS_SETTING_KEY);
  return value === "1";
}

async function refreshCache(): Promise<void> {
  if (Date.now() < cacheExpiresAt) return;

  const rows = await prisma.panelAccessIp.findMany({
    where: { isActive: true },
    select: { cidr: true },
  });

  cachedEntries = rows;
  cacheExpiresAt = Date.now() + 60_000;
}

export async function isPanelIpAllowed(ip: string): Promise<boolean> {
  if (!(await isPanelAccessEnabled())) return true;
  await refreshCache();
  if (cachedEntries.length === 0) return false;
  return cachedEntries.some((entry) => ipMatchesCidr(ip, entry.cidr));
}

export async function listPanelAccessIps(): Promise<PanelAccessIpRow[]> {
  const rows = await prisma.panelAccessIp.findMany({ orderBy: [{ isActive: "desc" }, { label: "asc" }] });
  return rows.map(mapRow);
}

export async function setPanelAccessEnabled(enabled: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: PANEL_ACCESS_SETTING_KEY },
    update: { value: enabled ? "1" : "0" },
    create: { key: PANEL_ACCESS_SETTING_KEY, value: enabled ? "1" : "0" },
  });
  await invalidateSettingCache(PANEL_ACCESS_SETTING_KEY);
  invalidatePanelAccessCache();
}

export async function addPanelAccessIp(input: {
  cidr: string;
  label: string;
  note?: string;
}): Promise<PanelAccessIpRow> {
  const cidr = normalizeCidr(input.cidr);
  if (!cidr) throw new Error("Geçersiz IP veya CIDR");

  const label = input.label.trim().slice(0, 120);
  if (!label) throw new Error("Etiket gerekli");

  const row = await prisma.panelAccessIp.create({
    data: {
      cidr,
      label,
      note: input.note?.trim().slice(0, 500) ?? null,
    },
  });

  invalidatePanelAccessCache();
  return mapRow(row);
}

export async function updatePanelAccessIp(
  id: number,
  input: Partial<{ cidr: string; label: string; note: string | null; is_active: boolean }>,
): Promise<PanelAccessIpRow> {
  const data: Record<string, unknown> = {};
  if (input.cidr != null) {
    const cidr = normalizeCidr(input.cidr);
    if (!cidr) throw new Error("Geçersiz IP veya CIDR");
    data.cidr = cidr;
  }
  if (input.label != null) data.label = input.label.trim().slice(0, 120);
  if (input.note !== undefined) data.note = input.note?.trim().slice(0, 500) ?? null;
  if (input.is_active != null) data.isActive = input.is_active;

  const row = await prisma.panelAccessIp.update({ where: { id }, data });
  invalidatePanelAccessCache();
  return mapRow(row);
}

export async function deletePanelAccessIp(id: number): Promise<void> {
  await prisma.panelAccessIp.delete({ where: { id } });
  invalidatePanelAccessCache();
}

export async function importPanelAccessIps(
  items: Array<{ cidr: string; label: string; note?: string }>,
): Promise<{ created: number; skipped: number }> {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Boş import listesi");
  if (items.length > 200) throw new Error("En fazla 200 kayıt import edilebilir");

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      await addPanelAccessIp(item);
      created++;
    } catch {
      skipped++;
    }
  }

  return { created, skipped };
}
