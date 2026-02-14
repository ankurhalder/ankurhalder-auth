import type { IUserRepository } from "@domain/repositories/user.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { RequestContext } from "@app/dtos/auth.dto";
import { TokenError } from "@domain/errors/token.error";
import { sha256Hash } from "@infra/crypto/hash";

/**
 * Output DTO for email verification.
 */
export interface VerifyEmailInput {
  /** The raw verification token from the URL query parameter */
  token: string;
}

export interface VerifyEmailOutput {
  success: true;
  message: string;
}

/**
 * VerifyEmailUseCase — Confirms user's email address ownership.
 *
 * Flow:
 * 1. Hash the incoming token: SHA256(token)
 * 2. Find user by verificationTokenHash
 * 3. Validate the token has not expired (1-hour expiry)
 * 4. Set isVerified = true
 * 5. Clear all verification token fields from user document
 * 6. Emit AUTH_EVENT: EMAIL_VERIFIED
 * 7. Return success
 *
 * Error cases:
 * - Token not found in DB: TokenError("invalid_signature")
 * - Token expired: TokenError("expired")
 * - User already verified: still succeeds (idempotent)
 *
 * Security considerations:
 * - The raw token is NEVER stored in the database. Only the SHA256 hash is stored.
 * - The raw token is sent to the user's email. They present it back via URL.
 * - Even if the database is compromised, the attacker cannot derive valid tokens.
 * - Tokens are one-time use: cleared from the user document after verification.
 */
export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authEventRepository: IAuthEventRepository
  ) {}

  async execute(
    input: VerifyEmailInput,
    ctx: RequestContext
  ): Promise<VerifyEmailOutput> {
    const tokenHash = sha256Hash(input.token);

    const user =
      await this.userRepository.findByVerificationTokenHash(tokenHash);

    if (!user) {
      void this.authEventRepository.create({
        eventType: "EMAIL_VERIFICATION_FAILED",
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
        "Invalid or expired verification link"
      );
    }

    if (
      user.verificationTokenExpiry &&
      user.verificationTokenExpiry < new Date()
    ) {
      await this.userRepository.updateVerification(user.id, {
        isVerified: false,
        verificationToken: null,
        verificationTokenHash: null,
        verificationTokenExpiry: null,
      });

      void this.authEventRepository.create({
        eventType: "EMAIL_VERIFICATION_FAILED",
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
        "Verification link has expired. Please request a new one."
      );
    }

    await this.userRepository.updateVerification(user.id, {
      isVerified: true,
      verificationToken: null,
      verificationTokenHash: null,
      verificationTokenExpiry: null,
    });

    void this.authEventRepository.create({
      eventType: "EMAIL_VERIFIED",
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
      success: true,
      message: "Email verified successfully. You can now sign in.",
    };
  }
}
