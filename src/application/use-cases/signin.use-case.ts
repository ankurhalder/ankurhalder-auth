import { v4 as uuidv4 } from "uuid";
import type { IUserRepository } from "@domain/repositories/user.repository";
import type { ISessionRepository } from "@domain/repositories/session.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { ITokenService } from "@app/interfaces/token.service";
import type { IEmailProvider } from "@app/interfaces/email.provider";
import type {
  SigninInput,
  SigninOutput,
  RequestContext,
} from "@app/dtos/auth.dto";
import { AuthenticationError } from "@domain/errors/authentication.error";
import { ValidationError } from "@domain/errors/validation.error";
import { UserMethods } from "@domain/entities/user.entity";
import { verifyPassword, hashPassword } from "@infra/crypto/password.service";
import { sha256Hash } from "@infra/crypto/hash";
import {
  generateOtp,
  encryptOtp,
  OTP_EXPIRY_MS,
} from "@infra/crypto/otp.service";
import { checkOtpRateLimit } from "@infra/redis/otp-rate-limiter";

/** Default session duration: 7 days */
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** RememberMe session duration: 30 days */
const REMEMBER_ME_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * SigninUseCase — Authenticates a user.
 *
 * Two paths:
 * A) Standard user: verify credentials -> create session -> return tokens
 * B) Admin user: verify credentials -> generate OTP -> send email -> return { requiresOtp: true }
 *
 * Security behaviors:
 * - Unverified users cannot sign in
 * - Generic "Invalid credentials" error prevents user enumeration
 * - PBKDF2 legacy hashes are auto-migrated to bcrypt on success
 * - Admin OTP has escalating backoff rate limiting
 */
export class SigninUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly tokenService: ITokenService,
    private readonly emailProvider: IEmailProvider
  ) {}

  async execute(
    input: SigninInput,
    ctx: RequestContext
  ): Promise<SigninOutput> {
    const email = input.email.toLowerCase().trim();

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      void this.authEventRepository.create({
        eventType: "SIGNIN_FAILED",
        email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "user_not_found",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });
      throw new AuthenticationError("Invalid credentials");
    }

    if (!user.isVerified) {
      void this.authEventRepository.create({
        eventType: "SIGNIN_FAILED",
        userId: user.id,
        email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "email_not_verified",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });
      throw new ValidationError(
        "Please verify your email address before signing in"
      );
    }

    const { valid, needsRehash } = await verifyPassword(
      input.password,
      user.hashedPassword
    );

    if (!valid) {
      void this.authEventRepository.create({
        eventType: "SIGNIN_FAILED",
        userId: user.id,
        email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "invalid_password",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });
      throw new AuthenticationError("Invalid credentials");
    }

    if (needsRehash) {
      hashPassword(input.password)
        .then((newHash) => this.userRepository.updatePassword(user.id, newHash))
        .catch((error: unknown) => {
          console.error(
            `[SigninUseCase] Failed to migrate password hash for ${user.id}:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        });
    }

    if (UserMethods.isAdmin(user)) {
      return this.handleAdminSignin(user, ctx);
    }

    return this.handleStandardSignin(user, input.rememberMe ?? false, ctx);
  }

  /**
   * Admin sign-in: generate and send OTP, require second factor.
   */
  private async handleAdminSignin(
    user: {
      id: string;
      email: string;
      role: "admin" | "user";
      tier: "free" | "pro";
    },
    ctx: RequestContext
  ): Promise<SigninOutput> {
    const otpLimit = await checkOtpRateLimit(user.id);
    if (!otpLimit.allowed) {
      void this.authEventRepository.create({
        eventType: "OTP_SENT",
        userId: user.id,
        email: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: `otp_rate_limited:${otpLimit.retryAfterSeconds}s`,
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });
      throw new AuthenticationError(
        `Too many OTP requests. Please try again in ${otpLimit.retryAfterSeconds} seconds.`
      );
    }

    const plainOtp = generateOtp();
    const encryptedOtp = encryptOtp(plainOtp);
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.userRepository.updateOtp(user.id, {
      otpSecret: encryptedOtp,
      otpExpiry,
      otpAttempts: 0,
    });

    this.emailProvider
      .sendOtpEmail(user.email, plainOtp)
      .catch((error: unknown) => {
        console.error(
          `[SigninUseCase] Failed to send OTP email to ${user.email}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      });

    void this.authEventRepository.create({
      eventType: "OTP_SENT",
      userId: user.id,
      email: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      isAuthenticated: false,
      requiresOtp: true,
      otpSent: true,
      message: "Verification code sent to your email",
    };
  }

  /**
   * Standard user sign-in: create session in DB, generate JWT tokens.
   */
  private async handleStandardSignin(
    user: {
      id: string;
      email: string;
      role: "admin" | "user";
      tier: "free" | "pro";
      tokenVersion: number;
    },
    rememberMe: boolean,
    ctx: RequestContext
  ): Promise<SigninOutput> {
    const sessionId = uuidv4();
    const ttlSeconds = rememberMe
      ? REMEMBER_ME_SESSION_TTL_SECONDS
      : DEFAULT_SESSION_TTL_SECONDS;

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
        ttlSeconds,
      }),
    ]);

    const refreshTokenHash = sha256Hash(refreshResult.token);

    await this.sessionRepository.create({
      sessionId,
      userId: user.id,
      refreshTokenHash,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      lastUsedAt: new Date(),
    });

    void this.authEventRepository.create({
      eventType: "SIGNIN",
      userId: user.id,
      email: user.email,
      sessionId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      metadata: { rememberMe },
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return {
      isAuthenticated: true,
      requiresOtp: false,
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
