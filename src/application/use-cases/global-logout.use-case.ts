import type { IUserRepository } from "@domain/repositories/user.repository";
import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IRevocationStore } from "@app/interfaces/revocation.store";
import type {
  GlobalLogoutInput,
  GlobalLogoutOutput,
  RequestContext,
} from "@app/dtos/auth.dto";
import { NotFoundError } from "@domain/errors/not-found.error";
import { UserMethods } from "@domain/entities/user.entity";

const USER_REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60;

export class GlobalLogoutUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly revocationStore: IRevocationStore
  ) {}

  async execute(
    input: GlobalLogoutInput,
    ctx: RequestContext
  ): Promise<GlobalLogoutOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const newTokenVersion = UserMethods.incrementTokenVersion(user);
    await this.userRepository.updateTokenVersion(user.id, newTokenVersion);

    await this.revocationStore.revokeAllUserSessions(
      user.id,
      USER_REVOCATION_TTL_SECONDS
    );

    const deletedCount = await this.sessionRepository.deleteAllForUser(user.id);

    void this.authEventRepository.create({
      eventType: "GLOBAL_LOGOUT",
      userId: user.id,
      email: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      metadata: {
        sessionsDeleted: deletedCount,
        newTokenVersion,
      },
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      success: true,
      message: "All sessions have been revoked",
      sessionsRevoked: deletedCount,
    };
  }
}
