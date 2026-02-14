import type {
  AuthEventEntity,
  AuthEventType,
} from "@domain/entities/auth-event.entity";

/**
 * Port: Audit event data access.
 * Implemented by infrastructure/database/auth-event.repository.impl.ts
 *
 * IMPORTANT: The `create` method is always called fire-and-forget.
 * Audit logging failures MUST NOT block or fail auth operations.
 */
export interface IAuthEventRepository {
  create(event: Omit<AuthEventEntity, "id">): Promise<void>;

  findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; eventType?: AuthEventType }
  ): Promise<AuthEventEntity[]>;

  findByIp(
    ipAddress: string,
    options?: { limit?: number; since?: Date }
  ): Promise<AuthEventEntity[]>;
}
