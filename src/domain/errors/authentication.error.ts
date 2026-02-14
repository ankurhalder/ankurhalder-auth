import { DomainError } from "./base.error";

/**
 * Thrown when credentials are invalid (wrong email/password, bad OTP).
 *
 * SECURITY: The message should be generic to prevent user enumeration.
 * Do NOT say "user not found" vs "wrong password" — always "Invalid credentials".
 */
export class AuthenticationError extends DomainError {
  readonly code = "AUTHENTICATION_ERROR" as const;
  readonly statusCode = 401;

  constructor(message: string = "Invalid credentials") {
    super(message);
  }
}
