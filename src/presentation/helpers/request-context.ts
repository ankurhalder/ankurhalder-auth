import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { RequestContext } from "@app/dtos/auth.dto";

/**
 * Extract client IP address from request.
 * Checks X-Forwarded-For header (Vercel, CloudFlare) first, falls back to direct connection.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

/**
 * Extract User-Agent header from request.
 */
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") ?? "unknown";
}

/**
 * Generate a unique request ID for tracing.
 */
export function generateRequestId(): string {
  return uuidv4();
}

/**
 * Build a complete RequestContext from a Next.js request.
 * Used by all use cases for audit logging.
 */
export function buildRequestContext(req: NextRequest): RequestContext {
  return {
    requestId: generateRequestId(),
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}
