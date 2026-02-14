import type { ObjectId } from "mongodb";

/**
 * MongoDB document shape for the platform_sessions collection.
 */
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

/** Collection name */
export const SESSIONS_COLLECTION = "platform_sessions" as const;
