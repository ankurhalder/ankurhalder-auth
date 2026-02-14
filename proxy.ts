import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigins = env.ALLOWED_ORIGINS;
  const allowedDomain = ".ankurhalder.com";

  const isAllowed =
    origin &&
    (allowedOrigins.includes(origin) || origin.endsWith(allowedDomain));

  if (!isAllowed && origin) {
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
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-CSRF-Token",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "0",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy":
          "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        "Strict-Transport-Security":
          "max-age=63072000; includeSubDomains; preload",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      },
    });
  }

  const response = NextResponse.next();

  if (isAllowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'"
  );

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
