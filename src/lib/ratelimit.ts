import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// In-memory fallback for local development without Redis
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Sliding window / fixed window rate limiter
 * @param identifier Unique key (e.g., user_id or IP address)
 * @param maxRequests Maximum requests allowed in the window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;

  if (redis) {
    try {
      const windowMs = windowSeconds * 1000;
      const clearBefore = now - windowMs;

      // Sliding window using Redis sorted set
      const multi = redis.pipeline();
      multi.zremrangebyscore(key, 0, clearBefore);
      multi.zadd(key, { score: now, member: `${now}:${Math.random()}` });
      multi.zcard(key);
      multi.expire(key, windowSeconds);

      const results = await multi.exec();
      const currentCount = (results[2] as number) || 1;

      const success = currentCount <= maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount);

      return {
        success,
        limit: maxRequests,
        remaining,
        reset: Math.floor((now + windowMs) / 1000),
      };
    } catch (error) {
      console.warn("[RateLimit] Redis error, falling back to memory:", error);
    }
  }

  // In-memory fallback
  const record = memoryStore.get(key);
  if (!record || record.expiresAt < now) {
    memoryStore.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    });
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Math.floor((now + windowSeconds * 1000) / 1000),
    };
  }

  record.count += 1;
  const success = record.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - record.count);

  return {
    success,
    limit: maxRequests,
    remaining,
    reset: Math.floor(record.expiresAt / 1000),
  };
}
