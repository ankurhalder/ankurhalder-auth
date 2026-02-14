import { ObjectId } from "mongodb";
import type { Collection } from "mongodb";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type {
  AuthEventEntity,
  AuthEventType,
} from "@domain/entities/auth-event.entity";
import { getCollection } from "./connection";
import type { AuthEventDocument } from "./schemas/auth-event.schema";
import { AUTH_EVENTS_COLLECTION } from "./schemas/auth-event.schema";

function toEntity(doc: AuthEventDocument): AuthEventEntity {
  return {
    id: doc._id.toHexString(),
    eventType: doc.eventType,
    userId: doc.userId,
    email: doc.email,
    sessionId: doc.sessionId,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    timestamp: doc.timestamp,
    success: doc.success,
    failureReason: doc.failureReason,
    metadata: doc.metadata,
    serviceId: doc.serviceId,
    requestId: doc.requestId,
  };
}

async function collection(): Promise<Collection<AuthEventDocument>> {
  return getCollection<AuthEventDocument>(AUTH_EVENTS_COLLECTION);
}

export class AuthEventRepositoryImpl implements IAuthEventRepository {
  /**
   * Write an audit event. Fire-and-forget.
   *
   * CRITICAL: This method catches all errors internally.
   * Audit logging failures MUST NOT propagate to callers.
   */
  async create(event: Omit<AuthEventEntity, "id">): Promise<void> {
    try {
      const col = await collection();
      await col.insertOne({
        _id: new ObjectId(),
        eventType: event.eventType,
        userId: event.userId,
        email: event.email,
        sessionId: event.sessionId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: event.timestamp,
        success: event.success,
        failureReason: event.failureReason,
        metadata: event.metadata,
        serviceId: event.serviceId,
        requestId: event.requestId,
      });
    } catch (error) {
      console.error(
        `[AuthEvent] Failed to write ${event.eventType} event:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; eventType?: AuthEventType }
  ): Promise<AuthEventEntity[]> {
    const col = await collection();
    const filter: Record<string, unknown> = { userId };

    if (options?.eventType) {
      filter.eventType = options.eventType;
    }

    const cursor = col
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(options?.offset ?? 0)
      .limit(options?.limit ?? 100);

    const docs = await cursor.toArray();
    return docs.map(toEntity);
  }

  async findByIp(
    ipAddress: string,
    options?: { limit?: number; since?: Date }
  ): Promise<AuthEventEntity[]> {
    const col = await collection();
    const filter: Record<string, unknown> = { ipAddress };

    if (options?.since) {
      filter.timestamp = { $gte: options.since };
    }

    const cursor = col
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(options?.limit ?? 100);

    const docs = await cursor.toArray();
    return docs.map(toEntity);
  }
}
