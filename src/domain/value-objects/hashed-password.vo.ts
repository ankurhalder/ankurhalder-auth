import { ValidationError } from "@domain/errors/validation.error";

export class HashedPassword {
  private static readonly BCRYPT_PREFIX = "$2b$";
  private static readonly BCRYPT_MIN_LENGTH = 59;

  readonly value: string;

  private constructor(hash: string) {
    this.value = hash;
  }

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

  isLegacy(): boolean {
    return !this.value.startsWith(HashedPassword.BCRYPT_PREFIX);
  }

  toString(): string {
    return "[REDACTED]";
  }
}
