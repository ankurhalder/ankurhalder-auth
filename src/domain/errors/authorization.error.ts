import { DomainError } from "./base.error";

export class AuthorizationError extends DomainError {
  readonly code = "AUTHORIZATION_ERROR" as const;
  readonly statusCode = 403;

  constructor(message: string = "Insufficient permissions") {
    super(message);
  }
}
