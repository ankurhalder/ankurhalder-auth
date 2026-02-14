/**
 * OTP Rate Limiter
 *
 * Implements escalating backoff for OTP generation requests.
 * Uses Redis for distributed rate limiting across serverless instances.
 *
 * Rate limits:
 * - 1st request: allowed immediately
 * - 2nd request: 30 seconds cooldown
 * - 3rd request: 60 seconds cooldown
 * - 4th request: 120 seconds cooldown
 * - 5th+ request: 300 seconds cooldown (5 minutes)
 */

import { getRedisClient } from "./client";

/** Escalating backoff intervals in seconds */
const BACKOFF_INTERVALS = [0, 30, 60, 120, 300];

/** Maximum backoff interval (5 minutes) */
const MAX_BACKOFF_SECONDS = 300;

/** TTL for the rate limit counter (24 hours) */
const RATE_LIMIT_TTL_SECONDS = 24 * 60 * 60;

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Check if an OTP request is allowed for the given user.
 * Implements escalating backoff based on attempt count.
 *
 * @param userId - User ID to check
 * @returns Rate limit result with allowed flag and retry-after seconds
 */
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

/**
 * Reset the OTP rate limit counter for a user.
 * Called after successful OTP verification.
 *
 * @param userId - User ID to reset
 */
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
