import { ValidationError } from "@domain/errors/validation.error";

/**
 * SessionId value object.
 * Wraps a UUID v4 string that uniquely identifies a session.
 */
export class SessionId {
  private static readonly UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  readonly value: string;

  private constructor(id: string) {
    this.value = id;
  }

  /**
   * Creates a SessionId from an existing UUID string.
   * @throws ValidationError if the string is not a valid UUID v4.
   */
  static create(id: string): SessionId {
    if (!SessionId.UUID_V4_REGEX.test(id)) {
      throw new ValidationError("Session ID must be a valid UUID v4");
    }
    return new SessionId(id);
  }

  /**
   * Creates a SessionId from a trusted source (no validation).
   */
  static fromTrusted(id: string): SessionId {
    return new SessionId(id);
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
