import { type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { AuthenticationError } from "@/domain/errors/authentication.error";
import { errorResponse } from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";

type RouteHandler = (request: NextRequest) => Promise<Response>;

export function withCsrf(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<Response> => {
    const context = buildRequestContext(request);

    try {
      if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        return handler(request);
      }

      const tokenFromHeader = request.headers.get("x-csrf-token");
      const tokenFromCookie = request.cookies.get("csrf-token")?.value;

      if (!tokenFromHeader || !tokenFromCookie) {
        throw new AuthenticationError("CSRF token missing");
      }

      const headerBuffer = Buffer.from(tokenFromHeader, "utf8");
      const cookieBuffer = Buffer.from(tokenFromCookie, "utf8");

      if (
        headerBuffer.length !== cookieBuffer.length ||
        !timingSafeEqual(headerBuffer, cookieBuffer)
      ) {
        throw new AuthenticationError("CSRF token invalid");
      }

      return handler(request);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return errorResponse(error, context.requestId);
      }
      throw error;
    }
  };
}
