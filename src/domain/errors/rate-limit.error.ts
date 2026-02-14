import { DomainError } from "./base.error";

/**
 * Thrown when a client exceeds their rate limit.
 * Carries retryAfter information for the Retry-After header.
 */
export class RateLimitError extends DomainError {
  readonly code = "RATE_LIMIT_ERROR" as const;
  readonly statusCode = 429;

  /** Seconds until the client can retry */
  readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super("Too many requests. Please try again later.");
    this.retryAfter = retryAfter;
  }
}
