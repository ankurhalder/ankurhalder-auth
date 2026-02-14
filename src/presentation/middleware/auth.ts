import { type NextRequest } from "next/server";
import { JwtServiceImpl } from "@/infrastructure/crypto/jwt.service";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { RevocationStoreImpl } from "@/infrastructure/redis/revocation.store.impl";
import { AuthenticationError } from "@/domain/errors/authentication.error";
import { AuthorizationError } from "@/domain/errors/authorization.error";
import { errorResponse } from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";

type RouteHandler = (
  request: NextRequest,
  context: { userId: string }
) => Promise<Response>;

export type AuthLevel = "user" | "admin";

const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  admin: 2,
};

export function withAuth(requiredLevel: AuthLevel = "user") {
  return function (
    handler: RouteHandler
  ): (request: NextRequest) => Promise<Response> {
    return async (request: NextRequest): Promise<Response> => {
      const context = buildRequestContext(request);

      try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          throw new AuthenticationError(
            "Missing or invalid authorization header"
          );
        }

        const token = authHeader.substring(7);

        const jwtService = new JwtServiceImpl();
        const payload = await jwtService.verifyAccessToken(token);

        if (
          !payload ||
          !payload.sub ||
          !payload.jti ||
          typeof payload.tv !== "number"
        ) {
          throw new AuthenticationError("Invalid token structure");
        }

        const revocationStore = new RevocationStoreImpl();
        const isRevoked = await revocationStore.isTokenRevoked(payload.jti);
        if (isRevoked) {
          throw new AuthenticationError("Token has been revoked");
        }

        const userRepository = new UserRepositoryImpl();
        const user = await userRepository.findById(payload.sub);

        if (!user) {
          throw new AuthenticationError("User not found");
        }

        if (user.tokenVersion !== payload.tv) {
          throw new AuthenticationError("Token version mismatch");
        }

        const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
        const requiredRoleLevel = ROLE_HIERARCHY[requiredLevel] || 0;

        if (userRoleLevel < requiredRoleLevel) {
          throw new AuthorizationError(
            `Insufficient permissions. Required: ${requiredLevel}`
          );
        }

        return handler(request, { userId: user.id });
      } catch (error) {
        if (
          error instanceof AuthenticationError ||
          error instanceof AuthorizationError
        ) {
          return errorResponse(error, context.requestId);
        }
        throw error;
      }
    };
  };
}
