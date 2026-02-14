import crypto from "node:crypto";
import { env } from "@/env";

/** AES-256-CBC configuration */
const ALGORITHM = "aes-256-cbc" as const;
const IV_LENGTH = 16;
const OTP_MIN = 10_000_000;
const OTP_MAX = 99_999_999;

/**
 * Get the encryption key as a Buffer.
 * The ENCRYPTION_KEY env var must be exactly 32 characters (256 bits).
 */
function getEncryptionKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "utf-8");
}

/**
 * Generate a cryptographically random 8-digit OTP.
 *
 * Uses crypto.randomInt() for uniform distribution.
 * Range: 10000000 to 99999999 (always exactly 8 digits).
 */
export function generateOtp(): string {
  const otp = crypto.randomInt(OTP_MIN, OTP_MAX + 1);
  return otp.toString();
}

/**
 * Encrypt an OTP using AES-256-CBC.
 *
 * Storage format: "{iv_hex}:{ciphertext_hex}"
 * The IV is random per encryption, ensuring the same OTP encrypts differently each time.
 *
 * @param otp The plaintext OTP string
 * @returns Encrypted string in format "iv:ciphertext" (hex-encoded)
 */
export function encryptOtp(otp: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(otp, "utf-8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an OTP from storage format.
 *
 * @param encryptedOtp The encrypted string in format "iv:ciphertext"
 * @returns The plaintext OTP string, or null if decryption fails
 */
export function decryptOtp(encryptedOtp: string): string | null {
  try {
    const colonIndex = encryptedOtp.indexOf(":");
    if (colonIndex === -1) return null;

    const ivHex = encryptedOtp.substring(0, colonIndex);
    const ciphertext = encryptedOtp.substring(colonIndex + 1);

    const iv = Buffer.from(ivHex, "hex");
    if (iv.length !== IV_LENGTH) return null;

    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(ciphertext, "hex", "utf-8");
    decrypted += decipher.final("utf-8");

    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Compare a submitted OTP against an encrypted stored OTP.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param submittedOtp The OTP submitted by the user
 * @param encryptedStoredOtp The encrypted OTP from the database
 * @returns true if the OTP matches
 */
export function verifyOtp(
  submittedOtp: string,
  encryptedStoredOtp: string
): boolean {
  const decrypted = decryptOtp(encryptedStoredOtp);
  if (!decrypted) return false;

  if (submittedOtp.length !== decrypted.length) {
    const buf = Buffer.from(decrypted);
    crypto.timingSafeEqual(buf, buf);
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(submittedOtp),
    Buffer.from(decrypted)
  );
}

/**
 * OTP expiry duration in milliseconds (15 minutes).
 */
export const OTP_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Maximum OTP verification attempts before lockout.
 */
export const OTP_MAX_ATTEMPTS = 5;
