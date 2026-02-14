import { Redis } from "@upstash/redis";
import { env } from "@/env";

/**
 * Singleton Upstash Redis client.
 *
 * - Lazy initialization: created on first use
 * - REST-based: no persistent connections (serverless-safe)
 * - Graceful degradation: callers check `isRedisAvailable()` before relying on data
 */
let redisClient: Redis | null = null;
let redisAvailable = true;
let lastRedisError: number = 0;

/** Cooldown before retrying Redis after a failure (30 seconds) */
const REDIS_RETRY_COOLDOWN_MS = 30_000;

/**
 * Get the Upstash Redis client instance.
 * Returns null if Redis is unavailable (missing env vars or connection failure).
 */
export function getRedisClient(): Redis | null {
  if (
    !redisAvailable &&
    Date.now() - lastRedisError < REDIS_RETRY_COOLDOWN_MS
  ) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn(
        "[Redis] Missing UPSTASH credentials. Running without Redis."
      );
      redisAvailable = false;
      return null;
    }

    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: true,
    });

    redisAvailable = true;
    return redisClient;
  } catch (error) {
    console.error(
      "[Redis] Failed to initialize client:",
      error instanceof Error ? error.message : "Unknown error"
    );
    redisAvailable = false;
    lastRedisError = Date.now();
    return null;
  }
}

/**
 * Check if Redis is currently considered available.
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * Record a Redis operation failure.
 * Called by consumers when a Redis command fails.
 */
export function recordRedisFailure(error: unknown): void {
  console.error(
    "[Redis] Operation failed:",
    error instanceof Error ? error.message : "Unknown error"
  );
  lastRedisError = Date.now();
}

/**
 * Export the singleton Redis client instance for direct use.
 * This is a convenience export that calls getRedisClient().
 * Prefer using getRedisClient() in most cases for better null handling.
 */
export { redisClient };
