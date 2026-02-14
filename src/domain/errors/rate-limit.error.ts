import { DomainError } from "./base.error";

export class RateLimitError extends DomainError {
  readonly code = "RATE_LIMIT_ERROR" as const;
  readonly statusCode = 429;

  readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super("Too many requests. Please try again later.");
    this.retryAfter = retryAfter;
  }
}
