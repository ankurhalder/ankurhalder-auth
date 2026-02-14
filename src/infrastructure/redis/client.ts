import { Redis } from "@upstash/redis";
import { env } from "@/env";

let redisClient: Redis | null = null;
let redisAvailable = true;
let lastRedisError: number = 0;

const REDIS_RETRY_COOLDOWN_MS = 30_000;

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

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function recordRedisFailure(error: unknown): void {
  console.error(
    "[Redis] Operation failed:",
    error instanceof Error ? error.message : "Unknown error"
  );
  lastRedisError = Date.now();
}

export { redisClient };
