import { Redis } from "ioredis";
import { config } from "../config.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
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
