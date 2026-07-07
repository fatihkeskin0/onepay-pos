import { Redis } from "ioredis";
import { config } from "../config.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10_000,
    });
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    await connectRedis();
    const result = await getRedis().ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function waitForRedis(maxAttempts = 20, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (await pingRedis()) {
        console.log("[redis] Connected");
        return;
      }
    } catch (err) {
      console.error(`[redis] Connect failed (attempt ${attempt}/${maxAttempts}):`, err);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Redis connection failed after ${maxAttempts} attempts`);
}
