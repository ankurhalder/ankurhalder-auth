import type { IUserRepository } from "@domain/repositories/user.repository";
import type { CurrentUserOutput } from "@app/dtos/user.dto";
import { NotFoundError } from "@domain/errors/not-found.error";

export interface GetCurrentUserInput {
  userId: string;
}

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
