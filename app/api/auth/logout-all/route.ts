import { type NextRequest } from "next/server";
import { GlobalLogoutUseCase } from "@/application/use-cases/global-logout.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { RevocationStoreImpl } from "@/infrastructure/redis/revocation.store.impl";
import { withCors } from "@/presentation/middleware/cors";
import { withAuth } from "@/presentation/middleware/auth";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { clearAuthCookies } from "@/presentation/helpers/cookies";

async function logoutAllHandler(
  request: NextRequest,
  authContext: { userId: string }
): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const userRepository = new UserRepositoryImpl();
    const sessionRepository = new SessionRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const revocationStore = new RevocationStoreImpl();

    const globalLogoutUseCase = new GlobalLogoutUseCase(
      userRepository,
      sessionRepository,
      authEventRepository,
      revocationStore
    );

    const result = await globalLogoutUseCase.execute(
      { userId: authContext.userId },
      context
    );

    const response = successResponse(
      {
        message: "Global logout successful. All sessions have been terminated.",
        sessionsRevoked: result.sessionsRevoked,
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

export const POST = withCors(withAuth("user")(logoutAllHandler));
