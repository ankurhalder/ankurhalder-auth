import { ValidationError } from "@domain/errors/validation.error";

/**
 * HashedPassword value object.
 * Guarantees the stored value is a bcrypt hash (starts with "$2b$")
 * or a legacy PBKDF2-SHA512 hash (contains ":" separator).
 *
 * NEVER stores a plaintext password.
 */
export class HashedPassword {
  private static readonly BCRYPT_PREFIX = "$2b$";
  private static readonly BCRYPT_MIN_LENGTH = 59;

  readonly value: string;

  private constructor(hash: string) {
    this.value = hash;
  }

  /**
   * Creates a HashedPassword from a hash string.
   * Validates that the string looks like a valid hash.
   * @throws ValidationError if the string is not a recognized hash format.
   */
  static create(hash: string): HashedPassword {
    if (!hash || hash.length < 10) {
      throw new ValidationError("Invalid password hash");
    }

    const isBcrypt =
      hash.startsWith(HashedPassword.BCRYPT_PREFIX) &&
      hash.length >= HashedPassword.BCRYPT_MIN_LENGTH;

    const isLegacyPbkdf2 = hash.includes(":");

    if (!isBcrypt && !isLegacyPbkdf2) {
      throw new ValidationError(
        "Password hash must be bcrypt or PBKDF2 format"
      );
    }

    return new HashedPassword(hash);
  }

  /**
   * Determines if this is a legacy PBKDF2-SHA512 hash.
   * If true, the password should be re-hashed with bcrypt on next successful login.
   */
  isLegacy(): boolean {
    return !this.value.startsWith(HashedPassword.BCRYPT_PREFIX);
  }

  toString(): string {
    return "[REDACTED]";
  }
}
