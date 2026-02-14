import { DomainError } from "./base.error";

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly statusCode = 400;

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
