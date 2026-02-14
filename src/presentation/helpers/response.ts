import { NextResponse } from "next/server";
import { AuthenticationError } from "@domain/errors/authentication.error";
import { AuthorizationError } from "@domain/errors/authorization.error";
import { ValidationError } from "@domain/errors/validation.error";
import { ConflictError } from "@domain/errors/conflict.error";
import { NotFoundError } from "@domain/errors/not-found.error";
import { RateLimitError } from "@domain/errors/rate-limit.error";
import { TokenError } from "@domain/errors/token.error";

export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(
  error: Error | string,
  requestIdOrCode: string,
  requestId?: string,
  status?: number,
  details?: unknown
): NextResponse {
  if (error instanceof Error) {
    return handleDomainError(error, requestIdOrCode);
  }

  const errorMessage = error;
  const code = requestIdOrCode;
  const reqId = requestId || "unknown";
  const statusCode = status || 500;

  const body: Record<string, unknown> = {
    error: errorMessage,
    code,
    requestId: reqId,
  };
  if (details) body.details = details;

  return NextResponse.json(body, { status: statusCode });
}

export function mapDomainErrorToHttp(error: Error): [number, string] {
  if (error instanceof AuthenticationError) {
    return [401, "AUTHENTICATION_ERROR"];
  }

  if (error instanceof AuthorizationError) {
    return [403, "AUTHORIZATION_ERROR"];
  }

  if (error instanceof ValidationError) {
    return [400, "VALIDATION_ERROR"];
  }

  if (error instanceof ConflictError) {
    return [409, "CONFLICT_ERROR"];
  }

  if (error instanceof NotFoundError) {
    return [404, "NOT_FOUND_ERROR"];
  }

  if (error instanceof RateLimitError) {
    return [429, "RATE_LIMIT_ERROR"];
  }

  if (error instanceof TokenError) {
    return [401, "TOKEN_ERROR"];
  }

  return [500, "INTERNAL_ERROR"];
}

export function handleDomainError(
  error: Error,
  requestId: string
): NextResponse {
  const [status, code] = mapDomainErrorToHttp(error);

  if (status === 500) {
    console.error(`[${requestId}] Internal error:`, error);
  }

  return errorResponse(error.message, code, requestId, status);
}
