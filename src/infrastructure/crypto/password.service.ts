import bcrypt from "bcrypt";
import crypto from "node:crypto";

/** bcrypt cost factor — 12 rounds (2^12 = 4096 iterations) */
const BCRYPT_ROUNDS = 12;

/** PBKDF2 parameters (for legacy password verification only) */
const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = "sha512";

/**
 * Hash a password using bcrypt with cost factor 12.
 *
 * @param plaintext The raw password
 * @returns bcrypt hash string (starts with "$2b$12$")
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash.
 *
 * Supports two hash formats:
 * 1. bcrypt (starts with "$2b$") — current standard
 * 2. PBKDF2-SHA512 (contains ":") — legacy format, auto-migrate on match
 *
 * @returns Object with `valid` (boolean) and `needsRehash` (true if legacy PBKDF2)
 */
export async function verifyPassword(
  plaintext: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  const isBcrypt =
    storedHash.startsWith("$2b$") || storedHash.startsWith("$2a$");

  if (isBcrypt) {
    const valid = await bcrypt.compare(plaintext, storedHash);
    return { valid, needsRehash: false };
  }

  const colonIndex = storedHash.indexOf(":");
  if (colonIndex === -1) {
    return { valid: false, needsRehash: false };
  }

  const salt = storedHash.substring(0, colonIndex);
  const expectedHash = storedHash.substring(colonIndex + 1);

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(
      plaintext,
      Buffer.from(salt, "hex"),
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });

  const derivedHex = derivedKey.toString("hex");
  const valid = timingSafeEqual(derivedHex, expectedHash);

  return { valid, needsRehash: true };
}

/**
 * Timing-safe string comparison.
 * Prevents timing attacks by always comparing all characters.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const bufA = Buffer.from(a);
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validate password complexity requirements.
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (!@#$%^&*()_+-=[]{}|;':",.<>/?)
 *
 * @returns null if valid, or an error message string describing what's missing
 */
export function validatePasswordComplexity(password: string): string | null {
  const issues: string[] = [];

  if (password.length < 8) {
    issues.push("at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    issues.push("an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    issues.push("a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    issues.push("a digit");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;':",.<>/?\\`~]/.test(password)) {
    issues.push("a special character");
  }

  if (issues.length === 0) return null;

  return `Password must contain ${issues.join(", ")}`;
}
