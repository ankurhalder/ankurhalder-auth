import { DomainError } from "./base.error";

/**
 * Thrown when an operation conflicts with existing state.
 * Primary use case: duplicate email on registration.
 */
export class ConflictError extends DomainError {
  readonly code = "CONFLICT_ERROR" as const;
  readonly statusCode = 409;

  constructor(message: string = "Resource already exists") {
    super(message);
  }
}
