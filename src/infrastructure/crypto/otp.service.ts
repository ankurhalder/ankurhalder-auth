import crypto from "node:crypto";
import { env } from "@/env";

const ALGORITHM = "aes-256-cbc" as const;
const IV_LENGTH = 16;
const OTP_MIN = 10_000_000;
const OTP_MAX = 99_999_999;

function getEncryptionKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "utf-8");
}

export function generateOtp(): string {
  const otp = crypto.randomInt(OTP_MIN, OTP_MAX + 1);
  return otp.toString();
}

export function encryptOtp(otp: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(otp, "utf-8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

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

export const OTP_EXPIRY_MS = 15 * 60 * 1000;

export const OTP_MAX_ATTEMPTS = 5;
