/**
 * Verify OTP Route Handler
 *
 * POST /api/auth/verify-otp
 * Rate limit: 10 requests per 15 minutes per IP
 * Middleware: CORS, Rate Limit
 */

import { type NextRequest } from "next/server";
import { VerifyOtpUseCase } from "@/application/use-cases/verify-otp.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { JwtServiceImpl } from "@/infrastructure/crypto/jwt.service";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { withCors } from "@/presentation/middleware/cors";
import { withRateLimit } from "@/presentation/middleware/rate-limit";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { setAuthCookies } from "@/presentation/helpers/cookies";
import { VerifyOtpSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";

async function verifyOtpHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    const validationResult = VerifyOtpSchema.safeParse(body);
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      throw new ValidationError("Invalid OTP data", fields);
    }

    const { email, otp } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const sessionRepository = new SessionRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const tokenService = new JwtServiceImpl();

    const verifyOtpUseCase = new VerifyOtpUseCase(
      userRepository,
      sessionRepository,
      authEventRepository,
      tokenService
    );

    const result = await verifyOtpUseCase.execute({ email, otp }, context);

    const response = successResponse(
      {
        message: "OTP verified successfully",
        user: result.user,
      },
      200
    );

    setAuthCookies(response, result.accessToken, result.refreshToken);

    return response;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const POST = withCors(withRateLimit(10, 900)(verifyOtpHandler));
