import bcrypt from "bcrypt";
import crypto from "node:crypto";

const BCRYPT_ROUNDS = 12;

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = "sha512";

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const bufA = Buffer.from(a);
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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
