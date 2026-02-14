import type { IUserRepository } from "@domain/repositories/user.repository";
import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IRevocationStore } from "@app/interfaces/revocation.store";
import type { RequestContext } from "@app/dtos/auth.dto";
import { TokenError } from "@domain/errors/token.error";
import { ValidationError } from "@domain/errors/validation.error";
import { UserMethods } from "@domain/entities/user.entity";
import {
  hashPassword,
  validatePasswordComplexity,
} from "@infra/crypto/password.service";
import { sha256Hash } from "@infra/crypto/hash";

export interface ResetPasswordInput {
  token: string;

  newPassword: string;
}

export interface ResetPasswordOutput {
  success: true;
  message: string;
}

const USER_REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60;

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly revocationStore: IRevocationStore
  ) {}

  async execute(
    input: ResetPasswordInput,
    ctx: RequestContext
  ): Promise<ResetPasswordOutput> {
    const tokenHash = sha256Hash(input.token);

    const user =
      await this.userRepository.findByPasswordResetTokenHash(tokenHash);

    if (!user) {
      void this.authEventRepository.create({
        eventType: "PASSWORD_RESET_FAILED",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "token_not_found",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });

      throw new TokenError(
        "invalid_signature",
        "Invalid or expired password reset link"
      );
    }

    if (
      user.passwordResetTokenExpiry &&
      user.passwordResetTokenExpiry < new Date()
    ) {
      await this.userRepository.clearPasswordResetToken(user.id);

      void this.authEventRepository.create({
        eventType: "PASSWORD_RESET_FAILED",
        userId: user.id,
        email: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "token_expired",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });

      throw new TokenError(
        "expired",
        "Password reset link has expired. Please request a new one."
      );
    }

    const passwordIssue = validatePasswordComplexity(input.newPassword);
    if (passwordIssue) {
      throw new ValidationError(passwordIssue);
    }

    const newHashedPassword = await hashPassword(input.newPassword);

    const newTokenVersion = UserMethods.incrementTokenVersion(user);
    await this.userRepository.updatePassword(
      user.id,
      newHashedPassword,
      newTokenVersion
    );

    await this.userRepository.clearPasswordResetToken(user.id);

    await this.revocationStore.revokeAllUserSessions(
      user.id,
      USER_REVOCATION_TTL_SECONDS
    );

    const deletedSessions = await this.sessionRepository.deleteAllForUser(
      user.id
    );

    void this.authEventRepository.create({
      eventType: "PASSWORD_RESET_COMPLETED",
      userId: user.id,
      email: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      metadata: {
        sessionsRevoked: deletedSessions,
        newTokenVersion,
      },
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      success: true,
      message:
        "Password has been reset successfully. Please sign in with your new password.",
    };
  }
}
