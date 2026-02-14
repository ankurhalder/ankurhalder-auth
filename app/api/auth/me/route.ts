/**
 * Get Current User Route Handler
 *
 * GET /api/auth/me
 * Middleware: CORS, Auth (user level)
 */

import { type NextRequest } from "next/server";
import { GetCurrentUserUseCase } from "@/application/use-cases/get-current-user.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { withCors } from "@/presentation/middleware/cors";
import { withAuth } from "@/presentation/middleware/auth";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";

async function getCurrentUserHandler(
  request: NextRequest,
  authContext: { userId: string }
): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const userRepository = new UserRepositoryImpl();

    const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);

    const result = await getCurrentUserUseCase.execute({
      userId: authContext.userId,
    });

    return successResponse(
      {
        id: result.id,
        email: result.email,
        isVerified: result.isVerified,
        role: result.role,
        createdAt: result.createdAt,
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

export const GET = withCors(withAuth("user")(getCurrentUserHandler));
