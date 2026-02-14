/**
 * Rate Limit Middleware
 *
 * Uses Upstash Ratelimit with sliding window algorithm.
 * Returns 429 with Retry-After header when limit exceeded.
 */

import { type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "@/infrastructure/redis/client";
import { RateLimitError } from "@/domain/errors/rate-limit.error";
import { errorResponse } from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";

type RouteHandler = (request: NextRequest) => Promise<Response>;

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Rate limit middleware wrapper
 *
 * @param maxRequests - Maximum number of requests allowed
 * @param windowSeconds - Time window in seconds
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit(maxRequests: number, windowSeconds: number) {
  return function (handler: RouteHandler): RouteHandler {
    const redis = getRedisClient();

    if (!redis) {
      console.warn("[RateLimit] Redis unavailable, skipping rate limit");
      return handler;
    }

    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds}s`),
      prefix: "ratelimit",
      analytics: true,
    });

    return async (request: NextRequest): Promise<Response> => {
      const context = buildRequestContext(request);
      const clientIp = getClientIp(request);

      try {
        const { success, limit, remaining, reset } =
          await limiter.limit(clientIp);

        if (!success) {
          const retryAfter = Math.ceil((reset - Date.now()) / 1000);
          throw new RateLimitError(retryAfter);
        }

        const response = await handler(request);

        response.headers.set("X-RateLimit-Limit", limit.toString());
        response.headers.set("X-RateLimit-Remaining", remaining.toString());
        response.headers.set("X-RateLimit-Reset", reset.toString());

        return response;
      } catch (error) {
        if (error instanceof RateLimitError) {
          return errorResponse(error, context.requestId);
        }
        throw error;
      }
    };
  };
}
