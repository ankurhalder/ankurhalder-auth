import { type NextRequest } from "next/server";
import { ResetPasswordUseCase } from "@/application/use-cases/reset-password.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { RevocationStoreImpl } from "@/infrastructure/redis/revocation.store.impl";
import { withCors } from "@/presentation/middleware/cors";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { ResetPasswordSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";

async function resetPasswordHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    const validationResult = ResetPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      throw new ValidationError("Invalid reset password data", fields);
    }

    const { token, newPassword } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const sessionRepository = new SessionRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const revocationStore = new RevocationStoreImpl();

    const resetPasswordUseCase = new ResetPasswordUseCase(
      userRepository,
      sessionRepository,
      authEventRepository,
      revocationStore
    );

    await resetPasswordUseCase.execute({ token, newPassword }, context);

    return successResponse(
      {
        message:
          "Password reset successful. You can now sign in with your new password.",
      },
      200
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const POST = withCors(resetPasswordHandler);
