import { v4 as uuidv4 } from "uuid";
import type { IUserRepository } from "@domain/repositories/user.repository";
import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { ITokenService } from "@app/interfaces/token.service";
import type { IRevocationStore } from "@app/interfaces/revocation.store";
import type {
  RefreshTokenInput,
  RefreshTokenOutput,
  RequestContext,
} from "@app/dtos/auth.dto";
import { TokenError } from "@domain/errors/token.error";
import { sha256Hash } from "@infra/crypto/hash";

const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly tokenService: ITokenService,
    private readonly revocationStore: IRevocationStore
  ) {}

  async execute(
    input: RefreshTokenInput,
    ctx: RequestContext
  ): Promise<RefreshTokenOutput> {
    const tokenHash = sha256Hash(input.refreshToken);

    const oldSession =
      await this.sessionRepository.findAndDeleteByRefreshTokenHash(tokenHash);

    if (!oldSession) {
      void this.authEventRepository.create({
        eventType: "TOKEN_REFRESH_FAILED",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "session_not_found",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });
      throw new TokenError("invalid_signature", "Invalid refresh token");
    }

    const refreshPayload = await this.tokenService.verifyRefreshToken(
      input.refreshToken
    );

    if (!refreshPayload) {
      void this.authEventRepository.create({
        eventType: "TOKEN_REFRESH_FAILED",
        userId: oldSession.userId,
        sessionId: oldSession.sessionId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "jwt_verification_failed",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });
      throw new TokenError("invalid_signature", "Invalid refresh token");
    }

    const [sessionRevoked, userRevocationTs] = await Promise.all([
      this.revocationStore.isSessionRevoked(refreshPayload.sessionId),
      this.revocationStore.getUserRevocationTimestamp(refreshPayload.sub),
    ]);

    if (sessionRevoked) {
      throw new TokenError("revoked", "Session has been revoked");
    }

    if (
      userRevocationTs !== null &&
      refreshPayload.iat * 1000 < userRevocationTs
    ) {
      throw new TokenError("revoked", "All sessions have been revoked");
    }

    const user = await this.userRepository.findById(refreshPayload.sub);

    if (!user) {
      throw new TokenError("user_not_found", "User no longer exists");
    }

    if (!user.isVerified) {
      throw new TokenError("user_not_verified", "User is not verified");
    }

    if (refreshPayload.tv !== user.tokenVersion) {
      throw new TokenError("version_mismatch", "Token version mismatch");
    }

    const newSessionId = uuidv4();

    const remainingMs = oldSession.expiresAt.getTime() - Date.now();
    const remainingSeconds = Math.max(
      Math.ceil(remainingMs / 1000),
      DEFAULT_SESSION_TTL_SECONDS
    );

    const [newAccessResult, newRefreshResult] = await Promise.all([
      this.tokenService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: newSessionId,
        tokenVersion: user.tokenVersion,
      }),
      this.tokenService.generateRefreshToken({
        userId: user.id,
        sessionId: newSessionId,
        tokenVersion: user.tokenVersion,
        ttlSeconds: remainingSeconds,
      }),
    ]);

    const newRefreshTokenHash = sha256Hash(newRefreshResult.token);

    await this.sessionRepository.create({
      sessionId: newSessionId,
      userId: user.id,
      refreshTokenHash: newRefreshTokenHash,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt: new Date(Date.now() + remainingSeconds * 1000),
      lastUsedAt: new Date(),
    });

    void this.authEventRepository.create({
      eventType: "TOKEN_REFRESH",
      userId: user.id,
      email: user.email,
      sessionId: newSessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      metadata: {
        oldSessionId: oldSession.sessionId,
        newSessionId,
      },
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      success: true,
      accessToken: newAccessResult.token,
      refreshToken: newRefreshResult.token,
    };
  }
}
