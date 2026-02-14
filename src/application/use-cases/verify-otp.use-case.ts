import { v4 as uuidv4 } from "uuid";
import type { IUserRepository } from "@domain/repositories/user.repository";
import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { ITokenService } from "@app/interfaces/token.service";
import type {
  VerifyOtpInput,
  VerifyOtpOutput,
  RequestContext,
} from "@app/dtos/auth.dto";
import { AuthenticationError } from "@domain/errors/authentication.error";
import { UserMethods } from "@domain/entities/user.entity";
import { verifyOtp } from "@infra/crypto/otp.service";
import { sha256Hash } from "@infra/crypto/hash";
import { resetOtpRateLimit } from "@infra/redis/otp-rate-limiter";

/** Admin sessions default to 7 days (no rememberMe for admin OTP flow) */
const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * VerifyOtpUseCase — Completes the admin two-factor authentication flow.
 *
 * Flow:
 * 1. Find user by email
 * 2. Check OTP preconditions (exists, not expired, not max attempts)
 * 3. Decrypt stored OTP and compare (timing-safe)
 * 4. If valid: create session, generate tokens, clear OTP fields, reset rate limit
 * 5. If invalid: increment attempts, check for lockout
 *
 * Security:
 * - Maximum 5 attempts per OTP
 * - 15-minute OTP expiry
 * - Timing-safe comparison (constant-time regardless of how many digits match)
 * - OTP fields cleared after successful verification
 */
export class VerifyOtpUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(
    input: VerifyOtpInput,
    ctx: RequestContext
  ): Promise<VerifyOtpOutput> {
    const email = input.email.toLowerCase().trim();

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AuthenticationError("Invalid credentials");
    }

    const precondition = UserMethods.validateOtpAttempt(user);

    switch (precondition.status) {
      case "noOtp":
        throw new AuthenticationError(
          "No verification code found. Please sign in again."
        );

      case "expired":
        await this.userRepository.clearOtp(user.id);
        void this.authEventRepository.create({
          eventType: "OTP_FAILED",
          userId: user.id,
          email,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          timestamp: new Date(),
          success: false,
          failureReason: "otp_expired",
          serviceId: "auth-service",
          requestId: ctx.requestId,
        });
        throw new AuthenticationError(
          "Verification code has expired. Please sign in again."
        );

      case "maxAttempts":
        await this.userRepository.clearOtp(user.id);
        void this.authEventRepository.create({
          eventType: "OTP_FAILED",
          userId: user.id,
          email,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          timestamp: new Date(),
          success: false,
          failureReason: "otp_max_attempts",
          serviceId: "auth-service",
          requestId: ctx.requestId,
        });
        throw new AuthenticationError(
          "Too many failed attempts. Please sign in again to receive a new code."
        );

      case "valid":
        break;
    }

    const otpMatches = verifyOtp(input.otp, user.otpSecret!);

    if (!otpMatches) {
      await this.userRepository.updateOtp(user.id, {
        otpSecret: user.otpSecret!,
        otpExpiry: user.otpExpiry!,
        otpAttempts: (user.otpAttempts ?? 0) + 1,
      });

      void this.authEventRepository.create({
        eventType: "OTP_FAILED",
        userId: user.id,
        email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "otp_mismatch",
        metadata: { attempt: (user.otpAttempts ?? 0) + 1 },
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });

      const remainingAttempts = 5 - ((user.otpAttempts ?? 0) + 1);
      throw new AuthenticationError(
        `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`
      );
    }

    await this.userRepository.clearOtp(user.id);

    await resetOtpRateLimit(user.id);

    const sessionId = uuidv4();

    const [accessResult, refreshResult] = await Promise.all([
      this.tokenService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId,
        tokenVersion: user.tokenVersion,
      }),
      this.tokenService.generateRefreshToken({
        userId: user.id,
        sessionId,
        tokenVersion: user.tokenVersion,
        ttlSeconds: ADMIN_SESSION_TTL_SECONDS,
      }),
    ]);

    const refreshTokenHash = sha256Hash(refreshResult.token);

    await this.sessionRepository.create({
      sessionId,
      userId: user.id,
      refreshTokenHash,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000),
      lastUsedAt: new Date(),
    });

    void this.authEventRepository.create({
      eventType: "OTP_VERIFIED",
      userId: user.id,
      email,
      sessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tier: user.tier,
      },
      accessToken: accessResult.token,
      refreshToken: refreshResult.token,
    };
  }
}
