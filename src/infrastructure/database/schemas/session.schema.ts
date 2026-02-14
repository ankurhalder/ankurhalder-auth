import type { ObjectId } from "mongodb";

export interface SessionDocument {
  _id: ObjectId;
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

export const SESSIONS_COLLECTION = "platform_sessions" as const;
