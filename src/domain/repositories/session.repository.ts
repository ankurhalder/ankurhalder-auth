import type { SessionEntity } from "@domain/entities/session.entity";

export interface ISessionRepository {
  create(
    session: Omit<SessionEntity, "id" | "createdAt">
  ): Promise<SessionEntity>;

  findByRefreshTokenHash(hash: string): Promise<SessionEntity | null>;

  findBySessionId(sessionId: string): Promise<SessionEntity | null>;

  findByUserId(userId: string): Promise<SessionEntity[]>;

  delete(sessionId: string): Promise<boolean>;

  deleteAllForUser(userId: string): Promise<number>;

  findAndDeleteByRefreshTokenHash(hash: string): Promise<SessionEntity | null>;

  updateLastUsed(sessionId: string, lastUsedAt: Date): Promise<void>;

  deleteExpiredSessions(): Promise<number>;
}
