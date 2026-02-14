/**
 * Port: Token revocation storage.
 *
 * Implements distributed session revocation using Redis.
 * Three granularity levels:
 * 1. Individual token (by JTI) — for single-token revocation
 * 2. Session (by sessionId) — for single-device logout
 * 3. User (by userId + timestamp) — for all-devices logout
 *
 * All revocations have a TTL matching the maximum token lifetime to
 * ensure the Redis database doesn't grow unbounded.
 */
export interface IRevocationStore {
  /**
   * Revoke an individual token by its JTI (JWT ID).
   *
   * @param jti The JWT ID (128-bit hex string)
   * @param ttlSeconds Time-to-live — should match the token's remaining lifetime
   */
  revokeToken(jti: string, ttlSeconds: number): Promise<void>;

  /**
   * Check if a token has been revoked by JTI.
   *
   * @param jti The JWT ID to check
   * @returns true if the token is revoked
   */
  isTokenRevoked(jti: string): Promise<boolean>;

  /**
   * Revoke an entire session (all tokens with this sessionId).
   *
   * @param sessionId The session UUID
   * @param ttlSeconds Time-to-live (typically 7 days for sessions)
   */
  revokeSession(sessionId: string, ttlSeconds: number): Promise<void>;

  /**
   * Check if a session has been revoked.
   *
   * @param sessionId The session UUID to check
   * @returns true if the session is revoked
   */
  isSessionRevoked(sessionId: string): Promise<boolean>;

  /**
   * Revoke all sessions for a user (timestamp-based).
   *
   * Stores the current timestamp. Any token issued BEFORE this timestamp
   * is considered revoked.
   *
   * @param userId The user ID
   * @param ttlSeconds Time-to-live (typically 30 days for max token lifetime)
   */
  revokeAllUserSessions(userId: string, ttlSeconds: number): Promise<void>;

  /**
   * Get the user-level revocation timestamp.
   *
   * @param userId The user ID
   * @returns The revocation timestamp (Unix milliseconds), or null if no revocation
   */
  getUserRevocationTimestamp(userId: string): Promise<number | null>;
}
