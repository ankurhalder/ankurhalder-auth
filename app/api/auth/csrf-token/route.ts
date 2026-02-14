import { type NextRequest } from "next/server";
import crypto from "node:crypto";
import { withCors } from "@/presentation/middleware/cors";
import { withRateLimit } from "@/presentation/middleware/rate-limit";
import {
  successResponse,
  errorResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { BASE_COOKIE_CONFIG } from "@/presentation/helpers/cookies";

const CSRF_TOKEN_BYTES = 32;
const CSRF_COOKIE_NAME = "csrf-token";

async function csrfTokenHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    const token = crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");

    const response = successResponse({ token }, 200);

    response.cookies.set(CSRF_COOKIE_NAME, token, BASE_COOKIE_CONFIG);

    return response;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const GET = withCors(withRateLimit(60, 60)(csrfTokenHandler));
