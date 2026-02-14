import { DomainError } from "./base.error";

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND_ERROR" as const;
  readonly statusCode = 404;

  constructor(message: string = "Resource not found") {
    super(message);
  }
}
