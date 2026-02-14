/**
 * Logout Route Handler
 *
 * POST /api/auth/logout
 * Middleware: CORS, Auth (user level)
 */

import { type NextRequest } from "next/server";
import { LogoutUseCase } from "@/application/use-cases/logout.use-case";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { RevocationStoreImpl } from "@/infrastructure/redis/revocation.store.impl";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { JwtServiceImpl } from "@/infrastructure/crypto/jwt.service";
import { withCors } from "@/presentation/middleware/cors";
import { withAuth } from "@/presentation/middleware/auth";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { clearAuthCookies } from "@/presentation/helpers/cookies";
import { AuthenticationError } from "@/domain/errors/authentication.error";

async function logoutHandler(
  request: NextRequest,
  authContext: { userId: string }
): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.substring(7) || "";

    const jwtService = new JwtServiceImpl();
    const payload = await jwtService.verifyAccessToken(accessToken);

    if (!payload || !payload.sessionId) {
      throw new AuthenticationError("Invalid access token");
    }

    const sessionRepository = new SessionRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const revocationStore = new RevocationStoreImpl();

    const logoutUseCase = new LogoutUseCase(
      sessionRepository,
      authEventRepository,
      revocationStore
    );

    await logoutUseCase.execute(
      {
        userId: authContext.userId,
        sessionId: payload.sessionId,
      },
      context
    );

    const response = successResponse(
      {
        message: "Logout successful",
      },
      200
    );

    clearAuthCookies(response);

    return response;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const POST = withCors(withAuth("user")(logoutHandler));
