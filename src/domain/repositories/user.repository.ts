import type { UserEntity } from "@domain/entities/user.entity";

/**
 * Port: User data access.
 * Implemented by infrastructure/database/user.repository.impl.ts
 */
export interface IUserRepository {
  /** Find user by email. Returns null if not found. */
  findByEmail(email: string): Promise<UserEntity | null>;

  /** Find user by MongoDB ObjectId. Returns null if not found. */
  findById(id: string): Promise<UserEntity | null>;

  /**
   * Create a new user. Returns the created user with generated id.
   * @throws ConflictError if email already exists (duplicate key).
   */
  create(
    user: Omit<UserEntity, "id" | "createdAt" | "updatedAt">
  ): Promise<UserEntity>;

  /**
   * Update the user's hashed password and (optionally) increment tokenVersion.
   * Used for password change and legacy hash migration.
   */
  updatePassword(
    userId: string,
    hashedPassword: string,
    tokenVersion?: number
  ): Promise<void>;

  /**
   * Update the token version. Used for global logout.
   */
  updateTokenVersion(userId: string, tokenVersion: number): Promise<void>;

  /**
   * Update verification-related fields.
   * Set isVerified=true, clear verification token fields.
   */
  updateVerification(
    userId: string,
    update: {
      isVerified: boolean;
      verificationToken?: string | null;
      verificationTokenHash?: string | null;
      verificationTokenExpiry?: Date | null;
    }
  ): Promise<void>;

  /**
   * Set OTP fields (admin sign-in flow).
   */
  updateOtp(
    userId: string,
    update: {
      otpSecret: string;
      otpExpiry: Date;
      otpAttempts: number;
    }
  ): Promise<void>;

  /**
   * Clear OTP fields after successful verification or expiry.
   */
  clearOtp(userId: string): Promise<void>;

  /**
   * Find user by verification token hash.
   */
  findByVerificationTokenHash(hash: string): Promise<UserEntity | null>;

  /**
   * Find user by password reset token hash.
   */
  findByPasswordResetTokenHash(hash: string): Promise<UserEntity | null>;

  /**
   * Set password reset token fields.
   */
  updatePasswordResetToken(
    userId: string,
    update: {
      passwordResetToken: string;
      passwordResetTokenHash: string;
      passwordResetTokenExpiry: Date;
    }
  ): Promise<void>;

  /**
   * Clear password reset token fields.
   */
  clearPasswordResetToken(userId: string): Promise<void>;

  /**
   * Set new verification token fields (for resend verification).
   */
  updateVerificationToken(
    userId: string,
    update: {
      verificationToken: string;
      verificationTokenHash: string;
      verificationTokenExpiry: Date;
    }
  ): Promise<void>;

  /**
   * Increment OTP attempts counter.
   */
  incrementOtpAttempts(userId: string): Promise<void>;
}
