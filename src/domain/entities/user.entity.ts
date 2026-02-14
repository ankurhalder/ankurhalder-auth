/**
 * Roles supported by the platform.
 * - "user": Standard authenticated user.
 * - "admin": Elevated privileges, requires OTP on sign-in.
 */
export type UserRole = "admin" | "user";

/**
 * Tier stubs for future billing/subscription support.
 * - "free": Default tier for all users.
 * - "pro": Reserved for future paid features.
 */
export type UserTier = "free" | "pro";

/**
 * Core user entity. Represents an authenticated identity on the platform.
 *
 * This entity is the authoritative source of truth for user state.
 * External systems (JWT claims, session records) may cache user data,
 * but the User entity in MongoDB is canonical.
 */
export interface UserEntity {
  /** MongoDB ObjectId as string */
  readonly id: string;

  /** Validated, normalized email (lowercase, trimmed) */
  email: string;

  /** bcrypt(12) hash — never a plaintext password */
  hashedPassword: string;

  /** User role: "admin" or "user" */
  role: UserRole;

  /** Whether the email address has been verified via token */
  isVerified: boolean;

  /**
   * Monotonically increasing version counter.
   * Incremented on: password change, global logout, security events.
   * JWTs carry `tv` claim; if token.tv < user.tokenVersion, token is invalid.
   */
  tokenVersion: number;

  /** Subscription tier stub */
  tier: UserTier;

  /**
   * AES-256-CBC encrypted verification token.
   * Format: "{iv_hex}:{ciphertext_hex}"
   * Present only while awaiting email verification.
   */
  verificationToken?: string;

  /**
   * SHA256 hash of the raw verification token.
   * Used for indexed lookup: hash the incoming token, query by this field.
   */
  verificationTokenHash?: string;

  /** Expiry timestamp for the verification token */
  verificationTokenExpiry?: Date;

  /** AES-256-CBC encrypted password reset token */
  passwordResetToken?: string;

  /** SHA256 hash of the raw reset token */
  passwordResetTokenHash?: string;

  /** Expiry timestamp for the reset token */
  passwordResetTokenExpiry?: Date;

  /**
   * AES-256-CBC encrypted 8-digit OTP.
   * Only set for admin users during sign-in flow.
   */
  otpSecret?: string;

  /** When the current OTP expires (15 minutes from generation) */
  otpExpiry?: Date;

  /**
   * Number of failed OTP verification attempts for the current code.
   * Resets to 0 when a new OTP is generated. Max 5 before lockout.
   */
  otpAttempts?: number;

  readonly createdAt: Date;
  updatedAt: Date;
}

/**
 * User entity methods.
 *
 * These are pure functions that operate on the UserEntity interface.
 * We use functions (not class methods) to keep entities as plain data
 * that survives serialization/deserialization to/from MongoDB seamlessly.
 */
export const UserMethods = {
  /**
   * Returns a new token version (current + 1).
   * The caller is responsible for persisting the incremented value.
   *
   * Used after: password change, global logout, security event.
   */
  incrementTokenVersion(user: UserEntity): number {
    return user.tokenVersion + 1;
  },

  /**
   * Checks if the user has the admin role.
   */
  isAdmin(user: UserEntity): boolean {
    return user.role === "admin";
  },

  /**
   * Determines if the user is eligible to request a new OTP.
   *
   * Rules:
   * - Must be an admin (only admins use OTP).
   * - If an existing OTP is still valid (not expired), deny the request
   *   to prevent OTP flooding.
   */
  canRequestOtp(user: UserEntity): boolean {
    if (user.role !== "admin") return false;
    if (user.otpExpiry && user.otpExpiry > new Date()) return false;
    return true;
  },

  /**
   * Validates an OTP submission attempt.
   *
   * Returns an object describing the result:
   * - valid: OTP matches and is within allowed attempts/expiry
   * - expired: OTP has passed its expiry time
   * - maxAttempts: Too many failed attempts (>=5)
   * - invalid: OTP does not match
   */
  validateOtpAttempt(user: UserEntity): {
    status: "valid" | "expired" | "maxAttempts" | "invalid" | "noOtp";
  } {
    if (!user.otpSecret || !user.otpExpiry) {
      return { status: "noOtp" };
    }

    if (user.otpExpiry < new Date()) {
      return { status: "expired" };
    }

    if ((user.otpAttempts ?? 0) >= 5) {
      return { status: "maxAttempts" };
    }

    return { status: "valid" };
  },
} as const;
