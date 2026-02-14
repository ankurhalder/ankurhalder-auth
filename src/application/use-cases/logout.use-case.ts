import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IRevocationStore } from "@app/interfaces/revocation.store";
import type {
  LogoutInput,
  LogoutOutput,
  RequestContext,
} from "@app/dtos/auth.dto";

const SESSION_REVOCATION_TTL_SECONDS = 7 * 24 * 60 * 60;

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
