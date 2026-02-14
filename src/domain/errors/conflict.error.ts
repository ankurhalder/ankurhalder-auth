import { DomainError } from "./base.error";

export class ConflictError extends DomainError {
  readonly code = "CONFLICT_ERROR" as const;
  readonly statusCode = 409;

  constructor(message: string = "Resource already exists") {
    super(message);
  }
}
