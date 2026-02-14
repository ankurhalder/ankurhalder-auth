import { type NextRequest } from "next/server";
import { SigninUseCase } from "@/application/use-cases/signin.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { JwtServiceImpl } from "@/infrastructure/crypto/jwt.service";
import { BrevoEmailProvider } from "@/infrastructure/email/brevo.provider";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { withCors } from "@/presentation/middleware/cors";
import { withRateLimit } from "@/presentation/middleware/rate-limit";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { setAuthCookies } from "@/presentation/helpers/cookies";
import { SigninSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";

async function signinHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    const validationResult = SigninSchema.safeParse(body);
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      throw new ValidationError("Invalid signin data", fields);
    }

    const { email, password, rememberMe } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const sessionRepository = new SessionRepositoryImpl();
    const tokenService = new JwtServiceImpl();
    const emailProvider = new BrevoEmailProvider();
    const authEventRepository = new AuthEventRepositoryImpl();

    const signinUseCase = new SigninUseCase(
      userRepository,
      sessionRepository,
      authEventRepository,
      tokenService,
      emailProvider
    );

    const result = await signinUseCase.execute(
      {
        email,
        password,
        rememberMe,
      },
      context
    );

    if (result.requiresOtp) {
      return successResponse(
        {
          message: "OTP sent to your email. Please verify to complete signin.",
          requiresOtp: true,
        },
        200
      );
    }

    const response = successResponse(
      {
        message: "Signin successful",
        user: result.user,
      },
      200
    );

    setAuthCookies(
      response,
      result.accessToken!,
      result.refreshToken!,
      rememberMe
    );

    return response;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const POST = withCors(withRateLimit(10, 900)(signinHandler));
