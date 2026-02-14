import { type NextRequest } from "next/server";
import { ForgotPasswordUseCase } from "@/application/use-cases/forgot-password.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { BrevoEmailProvider } from "@/infrastructure/email/brevo.provider";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { withCors } from "@/presentation/middleware/cors";
import { withRateLimit } from "@/presentation/middleware/rate-limit";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { ForgotPasswordSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";

async function forgotPasswordHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    const validationResult = ForgotPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      throw new ValidationError("Invalid email", fields);
    }

    const { email } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const emailProvider = new BrevoEmailProvider();

    const forgotPasswordUseCase = new ForgotPasswordUseCase(
      userRepository,
      authEventRepository,
      emailProvider
    );

    await forgotPasswordUseCase.execute({ email }, context);

    return successResponse(
      {
        message:
          "If an account exists with this email, a password reset link has been sent.",
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

export const POST = withCors(withRateLimit(3, 3600)(forgotPasswordHandler));
