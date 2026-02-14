import { ValidationError } from "@domain/errors/validation.error";

export class JTI {
  private static readonly HEX_128_REGEX = /^[0-9a-f]{32}$/;

  readonly value: string;

  private constructor(jti: string) {
    this.value = jti;
  }

  static create(jti: string): JTI {
    const lower = jti.toLowerCase();
    if (!JTI.HEX_128_REGEX.test(lower)) {
      throw new ValidationError("JTI must be a 32-character hex string");
    }
    return new JTI(lower);
  }

  static fromTrusted(jti: string): JTI {
    return new JTI(jti.toLowerCase());
  }

  equals(other: JTI): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
