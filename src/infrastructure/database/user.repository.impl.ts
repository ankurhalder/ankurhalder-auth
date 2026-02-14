import { ObjectId } from "mongodb";
import type { Collection } from "mongodb";
import type { IUserRepository } from "@domain/repositories/user.repository";
import type { UserEntity } from "@domain/entities/user.entity";
import { ConflictError } from "@domain/errors/conflict.error";
import { getCollection } from "./connection";
import type { UserDocument } from "./schemas/user.schema";
import { USERS_COLLECTION } from "./schemas/user.schema";

/**
 * Maps a MongoDB UserDocument to a domain UserEntity.
 * Converts ObjectId to string, strips MongoDB internals.
 */
function toEntity(doc: UserDocument): UserEntity {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    hashedPassword: doc.hashedPassword,
    role: doc.role,
    isVerified: doc.isVerified,
    tokenVersion: doc.tokenVersion,
    tier: doc.tier,
    verificationToken: doc.verificationToken,
    verificationTokenHash: doc.verificationTokenHash,
    verificationTokenExpiry: doc.verificationTokenExpiry,
    passwordResetToken: doc.passwordResetToken,
    passwordResetTokenHash: doc.passwordResetTokenHash,
    passwordResetTokenExpiry: doc.passwordResetTokenExpiry,
    otpSecret: doc.otpSecret,
    otpExpiry: doc.otpExpiry,
    otpAttempts: doc.otpAttempts,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Lazily resolved collection reference.
 */
async function collection(): Promise<Collection<UserDocument>> {
  return getCollection<UserDocument>(USERS_COLLECTION);
}

export class UserRepositoryImpl implements IUserRepository {
  async findByEmail(email: string): Promise<UserEntity | null> {
    const col = await collection();
    const doc = await col.findOne({ email: email.toLowerCase() });
    return doc ? toEntity(doc) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    if (!ObjectId.isValid(id)) return null;
    const col = await collection();
    const doc = await col.findOne({ _id: new ObjectId(id) });
    return doc ? toEntity(doc) : null;
  }

  async create(
    user: Omit<UserEntity, "id" | "createdAt" | "updatedAt">
  ): Promise<UserEntity> {
    const col = await collection();
    const now = new Date();

    const doc: Omit<UserDocument, "_id"> = {
      email: user.email.toLowerCase(),
      hashedPassword: user.hashedPassword,
      role: user.role,
      isVerified: user.isVerified,
      tokenVersion: user.tokenVersion,
      tier: user.tier,
      verificationToken: user.verificationToken,
      verificationTokenHash: user.verificationTokenHash,
      verificationTokenExpiry: user.verificationTokenExpiry,
      passwordResetToken: user.passwordResetToken,
      passwordResetTokenHash: user.passwordResetTokenHash,
      passwordResetTokenExpiry: user.passwordResetTokenExpiry,
      otpSecret: user.otpSecret,
      otpExpiry: user.otpExpiry,
      otpAttempts: user.otpAttempts,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await col.insertOne(doc as UserDocument);
      return toEntity({
        _id: result.insertedId,
        ...doc,
      } as UserDocument);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictError("An account with this email already exists");
      }
      throw error;
    }
  }

  async updatePassword(
    userId: string,
    hashedPassword: string,
    tokenVersion?: number
  ): Promise<void> {
    const col = await collection();
    const update: Record<string, unknown> = {
      hashedPassword,
      updatedAt: new Date(),
    };
    if (tokenVersion !== undefined) {
      update.tokenVersion = tokenVersion;
    }
    await col.updateOne({ _id: new ObjectId(userId) }, { $set: update });
  }

  async updateTokenVersion(
    userId: string,
    tokenVersion: number
  ): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { tokenVersion, updatedAt: new Date() } }
    );
  }

  async updateVerification(
    userId: string,
    update: {
      isVerified: boolean;
      verificationToken?: string | null;
      verificationTokenHash?: string | null;
      verificationTokenExpiry?: Date | null;
    }
  ): Promise<void> {
    const col = await collection();
    const $set: Record<string, unknown> = {
      isVerified: update.isVerified,
      updatedAt: new Date(),
    };
    const $unset: Record<string, ""> = {};

    if (update.verificationToken === null) {
      $unset.verificationToken = "";
    } else if (update.verificationToken !== undefined) {
      $set.verificationToken = update.verificationToken;
    }

    if (update.verificationTokenHash === null) {
      $unset.verificationTokenHash = "";
    } else if (update.verificationTokenHash !== undefined) {
      $set.verificationTokenHash = update.verificationTokenHash;
    }

    if (update.verificationTokenExpiry === null) {
      $unset.verificationTokenExpiry = "";
    } else if (update.verificationTokenExpiry !== undefined) {
      $set.verificationTokenExpiry = update.verificationTokenExpiry;
    }

    const updateOp: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) {
      updateOp.$unset = $unset;
    }

    await col.updateOne({ _id: new ObjectId(userId) }, updateOp);
  }

  async updateOtp(
    userId: string,
    update: {
      otpSecret: string;
      otpExpiry: Date;
      otpAttempts: number;
    }
  ): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          otpSecret: update.otpSecret,
          otpExpiry: update.otpExpiry,
          otpAttempts: update.otpAttempts,
          updatedAt: new Date(),
        },
      }
    );
  }

  async clearOtp(userId: string): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: {
          otpSecret: "",
          otpExpiry: "",
          otpAttempts: "",
        },
        $set: { updatedAt: new Date() },
      }
    );
  }

  async findByVerificationTokenHash(hash: string): Promise<UserEntity | null> {
    const col = await collection();
    const doc = await col.findOne({ verificationTokenHash: hash });
    return doc ? toEntity(doc) : null;
  }

  async findByPasswordResetTokenHash(hash: string): Promise<UserEntity | null> {
    const col = await collection();
    const doc = await col.findOne({ passwordResetTokenHash: hash });
    return doc ? toEntity(doc) : null;
  }

  async updatePasswordResetToken(
    userId: string,
    update: {
      passwordResetToken: string;
      passwordResetTokenHash: string;
      passwordResetTokenExpiry: Date;
    }
  ): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          passwordResetToken: update.passwordResetToken,
          passwordResetTokenHash: update.passwordResetTokenHash,
          passwordResetTokenExpiry: update.passwordResetTokenExpiry,
          updatedAt: new Date(),
        },
      }
    );
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: {
          passwordResetToken: "",
          passwordResetTokenHash: "",
          passwordResetTokenExpiry: "",
        },
        $set: { updatedAt: new Date() },
      }
    );
  }

  async updateVerificationToken(
    userId: string,
    update: {
      verificationToken: string;
      verificationTokenHash: string;
      verificationTokenExpiry: Date;
    }
  ): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          verificationToken: update.verificationToken,
          verificationTokenHash: update.verificationTokenHash,
          verificationTokenExpiry: update.verificationTokenExpiry,
          updatedAt: new Date(),
        },
      }
    );
  }

  async incrementOtpAttempts(userId: string): Promise<void> {
    const col = await collection();
    await col.updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { otpAttempts: 1 }, $set: { updatedAt: new Date() } }
    );
  }
}
