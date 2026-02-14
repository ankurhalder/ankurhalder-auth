import type { IUserRepository } from "@domain/repositories/user.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { IEmailProvider } from "@app/interfaces/email.provider";
import type {
  SignupInput,
  SignupOutput,
  RequestContext,
} from "@app/dtos/auth.dto";
import { ValidationError } from "@domain/errors/validation.error";
import { ConflictError } from "@domain/errors/conflict.error";
import {
  hashPassword,
  validatePasswordComplexity,
} from "@infra/crypto/password.service";
import { generateRandomToken, sha256Hash } from "@infra/crypto/hash";
import { encryptOtp } from "@infra/crypto/otp.service";

/**
 * SignupUseCase — Registers a new user.
 *
 * Flow:
 * 1. Validate password complexity (8+ chars, upper, lower, digit, special)
 * 2. Check if email is already registered
 * 3. Hash password with bcrypt(12)
 * 4. Generate verification token (32 random bytes = 64 hex chars)
 * 5. Store SHA256(token) on user for indexed lookup
 * 6. Store AES-encrypted token for email sending
 * 7. Create user in DB with tokenVersion: 0, tier: "free", isVerified: false
 * 8. Send verification email (fire-and-forget)
 * 9. Emit AUTH_EVENT: SIGNUP
 * 10. Return success message
 *
 * Error cases:
 * - Weak password: ValidationError (400)
 * - Duplicate email: ConflictError (409)
 * - Database failure: unhandled (500)
 */
export class SignupUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authEventRepository: IAuthEventRepository,
    private readonly emailProvider: IEmailProvider
  ) {}

  async execute(
    input: SignupInput,
    ctx: RequestContext
  ): Promise<SignupOutput> {
    const passwordIssue = validatePasswordComplexity(input.password);
    if (passwordIssue) {
      throw new ValidationError(passwordIssue);
    }

    const existing = await this.userRepository.findByEmail(
      input.email.toLowerCase().trim()
    );
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const hashedPassword = await hashPassword(input.password);

    const rawVerificationToken = generateRandomToken(32);
    const verificationTokenHash = sha256Hash(rawVerificationToken);
    const verificationTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    const encryptedVerificationToken = encryptOtp(rawVerificationToken);

    const user = await this.userRepository.create({
      email: input.email.toLowerCase().trim(),
      hashedPassword,
      role: "user",
      isVerified: false,
      tokenVersion: 0,
      tier: "free",
      verificationToken: encryptedVerificationToken,
      verificationTokenHash,
      verificationTokenExpiry,
    });

    this.emailProvider
      .sendVerificationEmail(user.email, rawVerificationToken)
      .catch((error: unknown) => {
        console.error(
          `[SignupUseCase] Failed to send verification email to ${user.email}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      });

    void this.authEventRepository.create({
      eventType: "SIGNUP",
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
        "Account created. Please check your email to verify your address.",
    };
  }
}
