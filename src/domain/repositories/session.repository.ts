import type { SessionEntity } from "@domain/entities/session.entity";

/**
 * Port: Session data access.
 * Implemented by infrastructure/database/session.repository.impl.ts
 */
export interface ISessionRepository {
  /**
   * Create a new session. Returns the created session with generated id.
   */
  create(
    session: Omit<SessionEntity, "id" | "createdAt">
  ): Promise<SessionEntity>;

  /**
   * Find a session by the refresh token hash.
   * Returns null if not found or expired.
   */
  findByRefreshTokenHash(hash: string): Promise<SessionEntity | null>;

  /**
   * Find a session by its UUID sessionId.
   */
  findBySessionId(sessionId: string): Promise<SessionEntity | null>;

  /**
   * Find all sessions for a user (for session management UI).
   */
  findByUserId(userId: string): Promise<SessionEntity[]>;

  /**
   * Delete a specific session by its UUID sessionId.
   * Returns true if a session was actually deleted.
   */
  delete(sessionId: string): Promise<boolean>;

  /**
   * Delete all sessions for a user (global logout).
   * Returns the count of deleted sessions.
   */
  deleteAllForUser(userId: string): Promise<number>;

  /**
   * Atomically find and delete a session by refresh token hash.
   * Used during token refresh to prevent race conditions.
   * Returns the deleted session, or null if not found.
   */
  findAndDeleteByRefreshTokenHash(hash: string): Promise<SessionEntity | null>;

  /**
   * Update the lastUsedAt timestamp.
   */
  updateLastUsed(sessionId: string, lastUsedAt: Date): Promise<void>;

  /**
   * Delete all expired sessions.
   * Used by the cleanup cron job.
   * Returns the count of deleted sessions.
   */
  deleteExpiredSessions(): Promise<number>;
}
