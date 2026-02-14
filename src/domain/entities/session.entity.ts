/**
 * Session entity. Represents an active authenticated session.
 *
 * Each sign-in (or token refresh) creates a new session.
 * Sessions are stored in MongoDB with a TTL index on expiresAt
 * for automatic cleanup.
 *
 * The refresh token is NEVER stored in plaintext — only its SHA256 hash.
 */
export interface SessionEntity {
  /** MongoDB ObjectId as string */
  readonly id: string;

  /**
   * UUID v4 session identifier.
   * Included in JWT claims as `sessionId`.
   * Used for targeted session revocation.
   */
  sessionId: string;

  /** Reference to the user (MongoDB ObjectId as string) */
  userId: string;

  /**
   * SHA256 hash of the refresh token.
   * When a refresh request arrives, hash the incoming token
   * and query by this field.
   */
  refreshTokenHash: string;

  /** Client IP address (from x-forwarded-for or x-real-ip) */
  ipAddress?: string;

  /** Raw User-Agent header value */
  userAgent?: string;

  /**
   * When this session expires.
   * - Default: 7 days from creation
   * - RememberMe: 30 days from creation
   * MongoDB TTL index on this field auto-deletes expired documents.
   */
  expiresAt: Date;

  /** When the session was created */
  readonly createdAt: Date;

  /**
   * When the session was last used for a token refresh.
   * Updated on every successful refresh.
   */
  lastUsedAt: Date;
}

/**
 * Session entity methods.
 */
export const SessionMethods = {
  /**
   * Checks if the session has passed its expiry time.
   * Note: MongoDB TTL index also enforces this, but checking in code
   * provides defense-in-depth.
   */
  isExpired(session: SessionEntity): boolean {
    return session.expiresAt < new Date();
  },

  /**
   * Returns the current timestamp for updating lastUsedAt.
   * The caller is responsible for persisting this.
   */
  getUpdatedLastUsed(): Date {
    return new Date();
  },
} as const;
