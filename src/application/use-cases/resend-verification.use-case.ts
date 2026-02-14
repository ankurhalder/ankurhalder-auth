import type { IUserRepository } from "@domain/repositories/user.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IEmailProvider } from "@app/interfaces/email.provider";
import type { RequestContext } from "@app/dtos/auth.dto";
import { ValidationError } from "@domain/errors/validation.error";
import { generateRandomToken, sha256Hash } from "@infra/crypto/hash";
import { encryptOtp } from "@infra/crypto/otp.service";

/**
 * Input/Output DTOs for resend verification.
 */
export interface ResendVerificationInput {
  email: string;
}

export interface ResendVerificationOutput {
  success: true;
  message: string;
}

/** Verification token expiry: 1 hour */
const VERIFICATION_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * ResendVerificationUseCase — Sends a new verification email.
 *
 * This use case is for users who:
 * - Never received the original verification email
 * - Had their verification link expire
 * - Accidentally deleted the email
 *
 * Flow:
 * 1. Find user by email
 * 2. If user not found: return generic success (prevents enumeration)
 * 3. If user already verified: return error (no point in reverifying)
 * 4. Generate a NEW verification token (invalidates any previous one)
 * 5. Store hash + encrypted token + new expiry
 * 6. Send verification email (fire-and-forget)
 * 7. Emit audit event
 * 8. Return success
 *
 * Rate limiting:
 * This endpoint is rate-limited to 3 requests per hour per IP
 * (handled by the presentation layer's rate limit middleware).
 *
 * SECURITY:
 * - Generating a new token invalidates the old one
 *   (the old hash is overwritten in the DB, so the old link no longer works)
 * - The response is generic when user not found (prevents enumeration)
 */
export class ResendVerificationUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly emailProvider: IEmailProvider
  ) {}

  async execute(
    input: ResendVerificationInput,
    ctx: RequestContext
  ): Promise<ResendVerificationOutput> {
    const email = input.email.toLowerCase().trim();

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return {
        success: true,
        message:
          "If an account exists with this email, a verification link has been sent.",
      };
    }

    if (user.isVerified) {
      throw new ValidationError("This email address is already verified");
    }

    const rawVerificationToken = generateRandomToken(32);
    const verificationTokenHash = sha256Hash(rawVerificationToken);
    const verificationTokenExpiry = new Date(
      Date.now() + VERIFICATION_TOKEN_EXPIRY_MS
    );
    const encryptedVerificationToken = encryptOtp(rawVerificationToken);

    await this.userRepository.updateVerificationToken(user.id, {
      verificationToken: encryptedVerificationToken,
      verificationTokenHash,
      verificationTokenExpiry,
    });

    this.emailProvider
      .sendVerificationEmail(user.email, rawVerificationToken)
      .catch((error: unknown) => {
        console.error(
          `[ResendVerificationUseCase] Failed to send verification email to ${user.email}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      });

    void this.authEventRepository.create({
      eventType: "VERIFICATION_RESENT",
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
      message:
        "If an account exists with this email, a verification link has been sent.",
    };
  }
}
