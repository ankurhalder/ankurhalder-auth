import type { Collection } from "mongodb";
import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { SessionEntity } from "@domain/entities/session.entity";
import { getCollection } from "./connection";
import type { SessionDocument } from "./schemas/session.schema";
import { SESSIONS_COLLECTION } from "./schemas/session.schema";

/**
 * Maps a MongoDB SessionDocument to a domain SessionEntity.
 */
function toEntity(doc: SessionDocument): SessionEntity {
  return {
    id: doc._id.toHexString(),
    sessionId: doc.sessionId,
    userId: doc.userId,
    refreshTokenHash: doc.refreshTokenHash,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt,
  };
}

async function collection(): Promise<Collection<SessionDocument>> {
  return getCollection<SessionDocument>(SESSIONS_COLLECTION);
}

export class SessionRepositoryImpl implements ISessionRepository {
  async create(
    session: Omit<SessionEntity, "id" | "createdAt">
  ): Promise<SessionEntity> {
    const col = await collection();
    const now = new Date();

    const doc: Omit<SessionDocument, "_id"> = {
      sessionId: session.sessionId,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      createdAt: now,
      lastUsedAt: session.lastUsedAt,
    };

    const result = await col.insertOne(doc as SessionDocument);
    return toEntity({
      _id: result.insertedId,
      ...doc,
    } as SessionDocument);
  }

  async findByRefreshTokenHash(hash: string): Promise<SessionEntity | null> {
    const col = await collection();
    const doc = await col.findOne({
      refreshTokenHash: hash,
      expiresAt: { $gt: new Date() },
    });
    return doc ? toEntity(doc) : null;
  }

  async findBySessionId(sessionId: string): Promise<SessionEntity | null> {
    const col = await collection();
    const doc = await col.findOne({
      sessionId,
      expiresAt: { $gt: new Date() },
    });
    return doc ? toEntity(doc) : null;
  }

  async findByUserId(userId: string): Promise<SessionEntity[]> {
    const col = await collection();
    const docs = await col
      .find({
        userId,
        expiresAt: { $gt: new Date() },
      })
      .sort({ expiresAt: -1 })
      .toArray();
    return docs.map(toEntity);
  }

  async delete(sessionId: string): Promise<boolean> {
    const col = await collection();
    const result = await col.deleteOne({ sessionId });
    return result.deletedCount > 0;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const col = await collection();
    const result = await col.deleteMany({ userId });
    return result.deletedCount;
  }

  async findAndDeleteByRefreshTokenHash(
    hash: string
  ): Promise<SessionEntity | null> {
    const col = await collection();
    const doc = await col.findOneAndDelete({
      refreshTokenHash: hash,
      expiresAt: { $gt: new Date() },
    });
    return doc ? toEntity(doc) : null;
  }

  async updateLastUsed(sessionId: string, lastUsedAt: Date): Promise<void> {
    const col = await collection();
    await col.updateOne({ sessionId }, { $set: { lastUsedAt } });
  }

  async deleteExpiredSessions(): Promise<number> {
    const col = await collection();
    const result = await col.deleteMany({
      expiresAt: { $lte: new Date() },
    });
    return result.deletedCount;
  }
}
