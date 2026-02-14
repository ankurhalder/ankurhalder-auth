export type UserRole = "admin" | "user";

export type UserTier = "free" | "pro";

export interface UserEntity {
  readonly id: string;

  email: string;

  hashedPassword: string;

  role: UserRole;

  isVerified: boolean;

  tokenVersion: number;

  tier: UserTier;

  verificationToken?: string;

  verificationTokenHash?: string;

  verificationTokenExpiry?: Date;

  passwordResetToken?: string;

  passwordResetTokenHash?: string;

  passwordResetTokenExpiry?: Date;

  otpSecret?: string;

  otpExpiry?: Date;

  otpAttempts?: number;

  readonly createdAt: Date;
  updatedAt: Date;
}

export const UserMethods = {
  incrementTokenVersion(user: UserEntity): number {
    return user.tokenVersion + 1;
  },

  isAdmin(user: UserEntity): boolean {
    return user.role === "admin";
  },

  canRequestOtp(user: UserEntity): boolean {
    if (user.role !== "admin") return false;
    if (user.otpExpiry && user.otpExpiry > new Date()) return false;
    return true;
  },

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
