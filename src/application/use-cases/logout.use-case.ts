import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IRevocationStore } from "@app/interfaces/revocation.store";
import type {
  LogoutInput,
  LogoutOutput,
  RequestContext,
} from "@app/dtos/auth.dto";

/** Session revocation TTL: 7 days (matches max session duration) */
const SESSION_REVOCATION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * LogoutUseCase — Signs out the current session.
 *
 * Flow:
 * 1. Revoke the session in Redis (so any existing access tokens are invalidated)
 * 2. Delete the session from MongoDB
 * 3. Clear auth cookies (done by presentation layer)
 * 4. Emit audit event
 *
 * Why both Redis revocation AND MongoDB deletion?
 * - Redis revocation: immediately invalidates any access tokens still in flight
 *   (access tokens are not checked against MongoDB on every request — only
 *   on refresh. Redis revocation catches the in-between.)
 * - MongoDB deletion: removes the refresh token capability permanently
 *
 * Cookie clearing is handled by the presentation layer (route handler).
 */
export class LogoutUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly revocationStore: IRevocationStore
  ) {}

  async execute(
    input: LogoutInput,
    ctx: RequestContext
  ): Promise<LogoutOutput> {
    await this.revocationStore.revokeSession(
      input.sessionId,
      SESSION_REVOCATION_TTL_SECONDS
    );

    await this.sessionRepository.delete(input.sessionId);

    void this.authEventRepository.create({
      eventType: "LOGOUT",
      userId: input.userId,
      sessionId: input.sessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      success: true,
      message: "Logged out successfully",
    };
  }
}
