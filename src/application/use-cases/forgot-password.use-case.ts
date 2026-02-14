import type { IUserRepository } from "@domain/repositories/user.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IEmailProvider } from "@app/interfaces/email.provider";
import type { RequestContext } from "@app/dtos/auth.dto";
import { generateRandomToken, sha256Hash } from "@infra/crypto/hash";
import { encryptOtp } from "@infra/crypto/otp.service";

/**
 * Input/Output DTOs for forgot password.
 */
export interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordOutput {
  success: true;
  message: string;
}

/** Password reset token expiry: 1 hour */
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * ForgotPasswordUseCase — Initiates the password reset flow.
 *
 * CRITICAL SECURITY RULE:
 * This endpoint ALWAYS returns the same response, whether the email exists
 * in the database or not. This prevents email enumeration attacks.
 *
 * Flow:
 * 1. Normalize email to lowercase
 * 2. Look up user by email
 * 3. If user NOT found: log the attempt, return generic success (STOP)
 * 4. If user found:
 *    a. Generate a cryptographically random reset token (32 bytes = 64 hex)
 *    b. Compute SHA256(token) for indexed storage
 *    c. Encrypt the raw token with AES-256-CBC for storage
 *    d. Store hash + encrypted token + expiry on user document
 *    e. Send password reset email (fire-and-forget) with raw token in URL
 *    f. Emit audit event
 * 5. Return generic success message
 *
 * Why store both hash AND encrypted token?
 * - Hash: enables O(1) indexed lookup when the user clicks the reset link
 * - Encrypted token: enables re-sending the same reset link if needed
 *   (without generating a new token and invalidating the old one)
 */
export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly emailProvider: IEmailProvider
  ) {}

  async execute(
    input: ForgotPasswordInput,
    ctx: RequestContext
  ): Promise<ForgotPasswordOutput> {
    const email = input.email.toLowerCase().trim();

    const genericResponse: ForgotPasswordOutput = {
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    };

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      void this.authEventRepository.create({
        eventType: "PASSWORD_RESET_REQUESTED",
        email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: "user_not_found",
        serviceId: "auth-service",
        requestId: ctx.requestId,
      });

      return genericResponse;
    }

    const rawResetToken = generateRandomToken(32);

    const resetTokenHash = sha256Hash(rawResetToken);

    const encryptedResetToken = encryptOtp(rawResetToken);

    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await this.userRepository.updatePasswordResetToken(user.id, {
      passwordResetToken: encryptedResetToken,
      passwordResetTokenHash: resetTokenHash,
      passwordResetTokenExpiry: resetTokenExpiry,
    });

    this.emailProvider
      .sendPasswordResetEmail(user.email, rawResetToken)
      .catch((error: unknown) => {
        console.error(
          `[ForgotPasswordUseCase] Failed to send reset email to ${user.email}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      });

    void this.authEventRepository.create({
      eventType: "PASSWORD_RESET_REQUESTED",
      userId: user.id,
      email: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      success: true,
      serviceId: "auth-service",
      requestId: ctx.requestId,
    });

    return genericResponse;
  }
}
