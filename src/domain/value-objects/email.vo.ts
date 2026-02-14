import { ValidationError } from "@domain/errors/validation.error";

/**
 * Email value object.
 * Validates format and normalizes to lowercase.
 *
 * @example
 * const email = Email.create("User@Example.COM");
 * console.log(email.value); // "user@example.com"
 */
export class Email {
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  private static readonly MAX_LENGTH = 254; // RFC 5321

  readonly value: string;

  private constructor(email: string) {
    this.value = email;
  }

  /**
   * Creates a validated, normalized Email.
   * @throws ValidationError if the email is invalid.
   */
  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();

    if (trimmed.length === 0) {
      throw new ValidationError("Email is required");
    }

    if (trimmed.length > Email.MAX_LENGTH) {
      throw new ValidationError(
        `Email must not exceed ${Email.MAX_LENGTH} characters`
      );
    }

    if (!Email.EMAIL_REGEX.test(trimmed)) {
      throw new ValidationError("Invalid email format");
    }

    return new Email(trimmed);
  }

  /**
   * Creates an Email from an already-validated string (e.g., from database).
   * Skips validation. Use only when the source is trusted.
   */
  static fromTrusted(email: string): Email {
    return new Email(email);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
