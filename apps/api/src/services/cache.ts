import { getRedis } from "./redis.js";

const PREFIX = "cache:";

export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  const cacheKey = `${PREFIX}${key}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached != null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // fall through to loader on Redis errors
  }

  const value = await loader();

  try {
    await redis.setex(cacheKey, ttlSec, JSON.stringify(value));
  } catch {
    // ignore cache write failures
  }

  return value;
}

export async function invalidate(key: string): Promise<void> {
  try {
    await getRedis().del(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}

export async function invalidatePrefix(prefix: string): Promise<void> {
  try {
    const redis = getRedis();
    const pattern = `${PREFIX}${prefix}*`;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // ignore
  }
}
