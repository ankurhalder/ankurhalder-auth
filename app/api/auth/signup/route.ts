import { type NextRequest } from "next/server";
import { SignupUseCase } from "@/application/use-cases/signup.use-case";
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
import { SignupSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";

async function signupHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    const validationResult = SignupSchema.safeParse(body);
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      throw new ValidationError("Invalid signup data", fields);
    }

    const { email, password, name } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const emailProvider = new BrevoEmailProvider();
    const authEventRepository = new AuthEventRepositoryImpl();

    const signupUseCase = new SignupUseCase(
      userRepository,
      authEventRepository,
      emailProvider
    );

    const result = await signupUseCase.execute(
      { email, password, name },
      context
    );

    return successResponse(
      {
        success: result.success,
        message: result.message,
      },
      201
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const POST = withCors(withRateLimit(10, 3600)(signupHandler));
