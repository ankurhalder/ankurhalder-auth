/**
 * Refresh Token Route Handler
 *
 * POST /api/auth/refresh
 * Rate limit: 20 requests per minute per IP
 * Middleware: CORS, Rate Limit
 */

import { type NextRequest } from "next/server";
import { RefreshTokenUseCase } from "@/application/use-cases/refresh-token.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { JwtServiceImpl } from "@/infrastructure/crypto/jwt.service";
import { RevocationStoreImpl } from "@/infrastructure/redis/revocation.store.impl";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { withCors } from "@/presentation/middleware/cors";
import { withRateLimit } from "@/presentation/middleware/rate-limit";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { setAuthCookies } from "@/presentation/helpers/cookies";
import { AuthenticationError } from "@/domain/errors/authentication.error";

async function refreshHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const refreshToken = request.cookies.get("refreshToken")?.value;

    if (!refreshToken) {
      throw new AuthenticationError("Refresh token not found");
    }

    const userRepository = new UserRepositoryImpl();
    const sessionRepository = new SessionRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const tokenService = new JwtServiceImpl();
    const revocationStore = new RevocationStoreImpl();

    const refreshTokenUseCase = new RefreshTokenUseCase(
      userRepository,
      sessionRepository,
      authEventRepository,
      tokenService,
      revocationStore
    );

    const result = await refreshTokenUseCase.execute({ refreshToken }, context);

    const response = successResponse(
      {
        message: "Token refreshed successfully",
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

export const POST = withCors(withRateLimit(20, 60)(refreshHandler));
