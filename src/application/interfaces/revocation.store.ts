export interface IRevocationStore {
  revokeToken(jti: string, ttlSeconds: number): Promise<void>;

  isTokenRevoked(jti: string): Promise<boolean>;

  revokeSession(sessionId: string, ttlSeconds: number): Promise<void>;

  isSessionRevoked(sessionId: string): Promise<boolean>;

  revokeAllUserSessions(userId: string, ttlSeconds: number): Promise<void>;

  getUserRevocationTimestamp(userId: string): Promise<number | null>;
}
