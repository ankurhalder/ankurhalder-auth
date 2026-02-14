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
