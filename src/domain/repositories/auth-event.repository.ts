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
  /**
   * Write an audit event.
   * Called fire-and-forget: failures are logged but not propagated.
   */
  create(event: Omit<AuthEventEntity, "id">): Promise<void>;

  /**
   * Find events by user ID, ordered by timestamp descending.
   * Used for admin audit trail.
   */
  findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; eventType?: AuthEventType }
  ): Promise<AuthEventEntity[]>;

  /**
   * Find events by IP address, ordered by timestamp descending.
   * Used for detecting suspicious activity from a single IP.
   */
  findByIp(
    ipAddress: string,
    options?: { limit?: number; since?: Date }
  ): Promise<AuthEventEntity[]>;
}
