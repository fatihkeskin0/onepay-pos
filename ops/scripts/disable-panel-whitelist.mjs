#!/usr/bin/env node
/**
 * Break-glass: disable panel login IP whitelist (panel_access_whitelist_enabled = 0).
 *
 * Inside api container:
 *   /app/ops/scripts/disable-panel-whitelist.sh
 *
 * From host (Coolify / compose):
 *   docker exec -it <api-container> /app/ops/scripts/disable-panel-whitelist.sh
 */

import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const SETTING_KEY = "panel_access_whitelist_enabled";

const prisma = new PrismaClient();

async function clearRedisSettingCache() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return false;

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    commandTimeout: 5000,
  });

  try {
    await redis.del(`cache:setting:${SETTING_KEY}`);
    return true;
  } catch (err) {
    console.warn(
      "[break-glass] Redis cache clear failed:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  } finally {
    redis.disconnect();
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL tanımlı değil");
  }

  const before = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  const wasEnabled = before?.value === "1";

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: "0" },
    create: { key: SETTING_KEY, value: "0" },
  });

  const redisCleared = await clearRedisSettingCache();

  console.log("[break-glass] Panel erişim whitelist KAPATILDI (value=0).");
  console.log(`[break-glass] Önceki durum: ${wasEnabled ? "etkin" : "kapalı veya ayar yoktu"}`);
  if (redisCleared) {
    console.log("[break-glass] Redis setting cache temizlendi.");
  } else if (!process.env.REDIS_URL?.trim()) {
    console.log("[break-glass] REDIS_URL yok; API ayar cache en fazla ~30sn sürebilir.");
  }
  console.log(
    "[break-glass] Panel IP bellek cache en fazla ~60sn sürebilir; gerekirse api container restart.",
  );
}

try {
  await main();
} catch (err) {
  console.error("[break-glass] Hata:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
