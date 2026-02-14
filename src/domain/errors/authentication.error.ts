import { DomainError } from "./base.error";

export class AuthenticationError extends DomainError {
  readonly code = "AUTHENTICATION_ERROR" as const;
  readonly statusCode = 401;

  constructor(message: string = "Invalid credentials") {
    super(message);
  }
}
