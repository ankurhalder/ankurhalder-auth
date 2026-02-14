import { DomainError } from "./base.error";

/**
 * Thrown when input fails validation (e.g., invalid email format,
 * weak password, malformed token).
 *
 * Can carry field-level details for structured error responses.
 */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly statusCode = 400;

  /** Optional field-level validation errors */
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.fields = fields;
  }

  override toJSON(): {
    code: string;
    message: string;
    fields?: Record<string, string>;
  } {
    return {
      ...super.toJSON(),
      ...(this.fields && { fields: this.fields }),
    };
  }
}
