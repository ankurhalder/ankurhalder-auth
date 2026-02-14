import { DomainError } from "./base.error";

/**
 * Token-specific error subtypes.
 */
export type TokenErrorReason =
  | "expired"
  | "revoked"
  | "invalid_signature"
  | "invalid_format"
  | "missing"
  | "version_mismatch"
  | "user_not_found"
  | "user_not_verified"
  | "role_drift";

/**
 * Thrown when a JWT or verification/reset token is invalid.
 * Carries the specific reason for debugging without exposing it to clients.
 */
export class TokenError extends DomainError {
  readonly code = "TOKEN_ERROR" as const;
  readonly statusCode = 401;

  /** Internal reason — logged but NOT sent to client */
  readonly reason: TokenErrorReason;

  constructor(
    reason: TokenErrorReason,
    message: string = "Invalid or expired token"
  ) {
    super(message);
    this.reason = reason;
  }
}
