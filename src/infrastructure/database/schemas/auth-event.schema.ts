import type { ObjectId } from "mongodb";
import type { AuthEventType } from "@domain/entities/auth-event.entity";

export interface AuthEventDocument {
  _id: ObjectId;
  eventType: AuthEventType;
  userId?: string;
  email?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  serviceId: string;
  requestId: string;
}

export const AUTH_EVENTS_COLLECTION = "platform_auth_events" as const;
