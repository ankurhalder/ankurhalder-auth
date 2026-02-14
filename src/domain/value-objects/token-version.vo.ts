import { ValidationError } from "@domain/errors/validation.error";

/**
 * TokenVersion value object.
 * Represents a non-negative integer used for token invalidation.
 */
export class TokenVersion {
  readonly value: number;

  private constructor(version: number) {
    this.value = version;
  }

  /**
   * Creates a validated TokenVersion.
   * @throws ValidationError if the value is negative or not an integer.
   */
  static create(version: number): TokenVersion {
    if (!Number.isInteger(version) || version < 0) {
      throw new ValidationError("Token version must be a non-negative integer");
    }
    return new TokenVersion(version);
  }

  /**
   * Returns a new TokenVersion incremented by 1.
   */
  increment(): TokenVersion {
    return new TokenVersion(this.value + 1);
  }

  equals(other: TokenVersion): boolean {
    return this.value === other.value;
  }
}
