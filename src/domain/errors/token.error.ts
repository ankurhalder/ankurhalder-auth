import { DomainError } from "./base.error";

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

export class TokenError extends DomainError {
  readonly code = "TOKEN_ERROR" as const;
  readonly statusCode = 401;

  readonly reason: TokenErrorReason;

  constructor(
    reason: TokenErrorReason,
    message: string = "Invalid or expired token"
  ) {
    super(message);
    this.reason = reason;
  }
}
