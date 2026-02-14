import type { ObjectId } from "mongodb";

/**
 * MongoDB document shape for the platform_users collection.
 * Maps to/from the UserEntity domain type.
 */
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

/** Collection name */
export const USERS_COLLECTION = "platform_users" as const;
