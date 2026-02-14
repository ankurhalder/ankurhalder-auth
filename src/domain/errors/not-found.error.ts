import { DomainError } from "./base.error";

/**
 * Thrown when a requested resource does not exist.
 * Example: user not found by ID, session not found.
 *
 * SECURITY: For public-facing operations (forgot password, verify email),
 * do NOT throw this error. Instead, return a generic success message
 * to prevent user/email enumeration.
 */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND_ERROR" as const;
  readonly statusCode = 404;

  constructor(message: string = "Resource not found") {
    super(message);
  }
}
