import { ValidationError } from "@domain/errors/validation.error";

export class TokenVersion {
  readonly value: number;

  private constructor(version: number) {
    this.value = version;
  }

  static create(version: number): TokenVersion {
    if (!Number.isInteger(version) || version < 0) {
      throw new ValidationError("Token version must be a non-negative integer");
    }
    return new TokenVersion(version);
  }

  increment(): TokenVersion {
    return new TokenVersion(this.value + 1);
  }

  equals(other: TokenVersion): boolean {
    return this.value === other.value;
  }
}
