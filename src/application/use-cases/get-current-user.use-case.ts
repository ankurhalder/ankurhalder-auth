import type { IUserRepository } from "@domain/repositories/user.repository";
import type { CurrentUserOutput } from "@app/dtos/user.dto";
import { NotFoundError } from "@domain/errors/not-found.error";

/**
 * Input DTO for get current user.
 */
export interface GetCurrentUserInput {
  /** User ID extracted from the verified access token */
  userId: string;
}

/**
 * GetCurrentUserUseCase — Returns the current user's profile data.
 *
 * This is the simplest use case. It:
 * 1. Fetches the user from the database by ID
 * 2. Returns only public-safe fields
 *
 * The access token has already been verified by the auth middleware
 * (all 8 verification steps including DB user fetch for tokenVersion check).
 * However, we still fetch the user here to ensure we return the most
 * up-to-date data (the middleware's user object may be stale if the
 * request was queued).
 *
 * SECURITY: The output explicitly EXCLUDES:
 * - hashedPassword
 * - verificationToken / verificationTokenHash
 * - passwordResetToken / passwordResetTokenHash
 * - otpSecret
 * - tokenVersion (internal implementation detail)
 * - Any other internal fields
 *
 * Only id, email, role, tier, isVerified, and createdAt are returned.
 */
export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<CurrentUserOutput> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
