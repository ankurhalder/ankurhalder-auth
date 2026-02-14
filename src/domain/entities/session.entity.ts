export interface SessionEntity {
  readonly id: string;

  sessionId: string;

  userId: string;

  refreshTokenHash: string;

  ipAddress?: string;

  userAgent?: string;

  expiresAt: Date;

  readonly createdAt: Date;

  lastUsedAt: Date;
}

export const SessionMethods = {
  isExpired(session: SessionEntity): boolean {
    return session.expiresAt < new Date();
  },

  getUpdatedLastUsed(): Date {
    return new Date();
  },
} as const;
