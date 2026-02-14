import { getRedisClient } from "./client";

const BACKOFF_INTERVALS = [0, 30, 60, 120, 300];

const MAX_BACKOFF_SECONDS = 300;

const RATE_LIMIT_TTL_SECONDS = 24 * 60 * 60;

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkOtpRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  if (!redis) {
    console.warn("[OTP RateLimit] Redis unavailable, allowing request");
    return { allowed: true };
  }

  const key = `otp:ratelimit:${userId}`;

  try {
    const data = await redis.get<{ count: number; lastAttempt: number }>(key);

    if (!data) {
      await redis.set(
        key,
        { count: 1, lastAttempt: Date.now() },
        {
          ex: RATE_LIMIT_TTL_SECONDS,
        }
      );
      return { allowed: true };
    }

    const { count, lastAttempt } = data;
    const now = Date.now();
    const secondsSinceLastAttempt = Math.floor((now - lastAttempt) / 1000);

    const backoffSeconds =
      count >= BACKOFF_INTERVALS.length
        ? MAX_BACKOFF_SECONDS
        : BACKOFF_INTERVALS[count] || 0;

    if (secondsSinceLastAttempt < backoffSeconds) {
      const retryAfterSeconds = backoffSeconds - secondsSinceLastAttempt;
      return {
        allowed: false,
        retryAfterSeconds,
      };
    }

    await redis.set(
      key,
      { count: count + 1, lastAttempt: now },
      {
        ex: RATE_LIMIT_TTL_SECONDS,
      }
    );

    return { allowed: true };
  } catch (error) {
    console.error(
      "[OTP RateLimit] Redis operation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return { allowed: true };
  }
}

export async function resetOtpRateLimit(userId: string): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  const key = `otp:ratelimit:${userId}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.error(
      "[OTP RateLimit] Failed to reset counter:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
