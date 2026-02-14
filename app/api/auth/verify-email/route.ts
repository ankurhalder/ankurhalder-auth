import { type NextRequest } from "next/server";
import { VerifyEmailUseCase } from "@/application/use-cases/verify-email.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { withCors } from "@/presentation/middleware/cors";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { VerifyEmailSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";

async function verifyEmailHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    let token: string | null = null;

    if (request.method === "GET") {
      token = request.nextUrl.searchParams.get("token");
    } else if (request.method === "POST") {
      const body: unknown = await request.json();
      const bodyObj = body as Record<string, unknown>;
      token = bodyObj.token as string | null;
    }

    const validationResult = VerifyEmailSchema.safeParse({ token });
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      throw new ValidationError("Invalid verification data", fields);
    }

    const { token: verifiedToken } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();

    const verifyEmailUseCase = new VerifyEmailUseCase(
      userRepository,
      authEventRepository
    );

    await verifyEmailUseCase.execute({ token: verifiedToken }, context);

    return successResponse(
      {
        message: "Email verified successfully. You can now sign in.",
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

export const GET = withCors(verifyEmailHandler);
export const POST = withCors(verifyEmailHandler);
