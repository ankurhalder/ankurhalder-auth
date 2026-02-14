import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

type RouteHandler = (request: NextRequest) => Promise<Response>;

export function withCors(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<Response> => {
    const origin = request.headers.get("origin");
    const allowedOrigins = env.ALLOWED_ORIGINS;
    const allowedDomain = ".ankurhalder.com";

    const isAllowed =
      origin &&
      (allowedOrigins.includes(origin) || origin.endsWith(allowedDomain));

    if (!isAllowed) {
      console.warn(`CORS blocked: ${origin} not in allowedOrigins`, {
        allowedOrigins,
        requestPath: request.url,
      });
    }

    if (request.method === "OPTIONS") {
      if (!isAllowed) {
        return new NextResponse(null, { status: 403 });
      }

      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-CSRF-Token",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = await handler(request);

    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Vary", "Origin");
    }

    return response;
  };
}
