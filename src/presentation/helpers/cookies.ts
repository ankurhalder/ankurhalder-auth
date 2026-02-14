import { NextResponse } from "next/server";
import { env } from "@/env";

const IS_PRODUCTION = env.NODE_ENV === "production";

const BASE_COOKIE_CONFIG = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  domain: IS_PRODUCTION ? ".ankurhalder.com" : undefined,
  path: "/",
};

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";

/**
 * Set authentication cookies on an HTTP response.
 *
 * @param res The Next.js response object
 * @param accessToken The JWT access token (15 min expiry)
 * @param refreshToken The JWT refresh token (7 or 30 days)
 * @param rememberMe If true, refresh token expires in 30 days. Otherwise 7 days.
 * @returns The response object (for chaining)
 */
export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean = false
): NextResponse {
  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...BASE_COOKIE_CONFIG,
    maxAge: 15 * 60,
  });

  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...BASE_COOKIE_CONFIG,
    maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
  });

  return res;
}

/**
 * Clear authentication cookies from an HTTP response.
 * Used on logout, global logout, and failed refresh.
 *
 * @param res The Next.js response object
 * @returns The response object (for chaining)
 */
export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...BASE_COOKIE_CONFIG,
    maxAge: 0,
  });

  res.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...BASE_COOKIE_CONFIG,
    maxAge: 0,
  });

  return res;
}
