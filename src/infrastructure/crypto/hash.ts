import crypto from "node:crypto";

/**
 * Hash a token using SHA256.
 *
 * Used for:
 * - Refresh tokens: hash before storing in platform_sessions.refreshTokenHash
 * - Verification tokens: hash before storing in platform_users.verificationTokenHash
 * - Password reset tokens: hash before storing in platform_users.passwordResetTokenHash
 *
 * Why hash before storage?
 * If the database is compromised, the attacker cannot use the stored hashes
 * to forge valid tokens. They would need the raw token (which only the client has).
 *
 * @param raw The raw token string to hash
 * @returns Lowercase hex-encoded SHA256 hash
 */
export function sha256Hash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Generate a cryptographically random token.
 *
 * Used for:
 * - Verification tokens (32 bytes = 64 hex chars)
 * - Password reset tokens (32 bytes = 64 hex chars)
 *
 * @param bytes Number of random bytes (default 32)
 * @returns Hex-encoded random string
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
