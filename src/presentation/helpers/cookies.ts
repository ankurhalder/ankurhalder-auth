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
