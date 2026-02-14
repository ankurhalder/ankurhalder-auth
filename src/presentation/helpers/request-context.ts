import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { RequestContext } from "@app/dtos/auth.dto";

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

export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") ?? "unknown";
}

export function generateRequestId(): string {
  return uuidv4();
}

export function buildRequestContext(req: NextRequest): RequestContext {
  return {
    requestId: generateRequestId(),
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}
