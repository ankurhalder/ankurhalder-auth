import type { IUserRepository } from "@domain/repositories/user.repository";
import type { IAuthEventRepository } from "@domain/repositories/auth-event.repository";
import type { RequestContext } from "@app/dtos/auth.dto";
import { TokenError } from "@domain/errors/token.error";
import { sha256Hash } from "@infra/crypto/hash";

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyEmailOutput {
  success: true;
  message: string;
}

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
