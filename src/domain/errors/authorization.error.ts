import { DomainError } from "./base.error";

/**
 * Thrown when an authenticated user lacks permission for an operation.
 * Example: non-admin user attempting admin-only actions.
 */
export class AuthorizationError extends DomainError {
  readonly code = "AUTHORIZATION_ERROR" as const;
  readonly statusCode = 403;

  constructor(message: string = "Insufficient permissions") {
    super(message);
  }
}
