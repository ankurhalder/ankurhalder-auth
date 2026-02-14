import type { ObjectId } from "mongodb";

export interface UserDocument {
  _id: ObjectId;
  email: string;
  hashedPassword: string;
  role: "admin" | "user";
  isVerified: boolean;
  tokenVersion: number;
  tier: "free" | "pro";

  verificationToken?: string;
  verificationTokenHash?: string;
  verificationTokenExpiry?: Date;

  passwordResetToken?: string;
  passwordResetTokenHash?: string;
  passwordResetTokenExpiry?: Date;

  otpSecret?: string;
  otpExpiry?: Date;
  otpAttempts?: number;

  createdAt: Date;
  updatedAt: Date;
}

export const USERS_COLLECTION = "platform_users" as const;
