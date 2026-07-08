import { performance } from "node:perf_hooks";
import { prisma } from "@onepara/db";
import { connectRedis, getRedis } from "./redis.js";

const WINDOW_MS = 30 * 60 * 1000;

interface HealthSample {
  t: number;
  db: boolean;
  redis: boolean;
  api: boolean;
}

const samples: HealthSample[] = [];

export async function checkDatabase(): Promise<{ ok: boolean; ms: number | null }> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, ms: null };
  }
}

export async function checkRedis(): Promise<{ ok: boolean; ms: number | null }> {
  const start = performance.now();
  try {
    await connectRedis();
    const pong = await getRedis().ping();
    return { ok: pong === "PONG", ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, ms: null };
  }
}

export function recordHealthSample(dbOk: boolean, redisOk: boolean, apiOk = true): void {
  const now = Date.now();
  samples.push({ t: now, db: dbOk, redis: redisOk, api: apiOk });
  while (samples.length > 0 && samples[0].t < now - WINDOW_MS) {
    samples.shift();
  }
}

function uptimePercent(key: "db" | "redis" | "api"): number {
  if (samples.length === 0) return 100;
  const okCount = samples.filter((s) => s[key]).length;
  return Math.round((okCount / samples.length) * 1000) / 10;
}

export function getHealthUptimePercents(): { db: number; redis: number; api: number; window_min: number } {
  return {
    db: uptimePercent("db"),
    redis: uptimePercent("redis"),
    api: uptimePercent("api"),
    window_min: Math.round(WINDOW_MS / 60_000),
  };
}

export async function collectSystemStatus() {
  const started = performance.now();
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const apiMs = Math.round(performance.now() - started);

  recordHealthSample(db.ok, redis.ok, true);
  const uptime = getHealthUptimePercents();

  return {
    db: { ok: db.ok, ms: db.ms, uptime_pct: uptime.db },
    redis: { ok: redis.ok, ms: redis.ms, uptime_pct: uptime.redis },
    api: { ok: true, ms: apiMs, uptime_pct: uptime.api },
    window_min: uptime.window_min,
    checked_at: new Date().toISOString(),
  };
}
