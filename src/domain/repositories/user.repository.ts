import type { UserEntity } from "@domain/entities/user.entity";

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;

  findById(id: string): Promise<UserEntity | null>;

  create(
    user: Omit<UserEntity, "id" | "createdAt" | "updatedAt">
  ): Promise<UserEntity>;

  updatePassword(
    userId: string,
    hashedPassword: string,
    tokenVersion?: number
  ): Promise<void>;

  updateTokenVersion(userId: string, tokenVersion: number): Promise<void>;

  updateVerification(
    userId: string,
    update: {
      isVerified: boolean;
      verificationToken?: string | null;
      verificationTokenHash?: string | null;
      verificationTokenExpiry?: Date | null;
    }
  ): Promise<void>;

  updateOtp(
    userId: string,
    update: {
      otpSecret: string;
      otpExpiry: Date;
      otpAttempts: number;
    }
  ): Promise<void>;

  clearOtp(userId: string): Promise<void>;

  findByVerificationTokenHash(hash: string): Promise<UserEntity | null>;

  findByPasswordResetTokenHash(hash: string): Promise<UserEntity | null>;

  updatePasswordResetToken(
    userId: string,
    update: {
      passwordResetToken: string;
      passwordResetTokenHash: string;
      passwordResetTokenExpiry: Date;
    }
  ): Promise<void>;

  clearPasswordResetToken(userId: string): Promise<void>;

  updateVerificationToken(
    userId: string,
    update: {
      verificationToken: string;
      verificationTokenHash: string;
      verificationTokenExpiry: Date;
    }
  ): Promise<void>;

  incrementOtpAttempts(userId: string): Promise<void>;
}
