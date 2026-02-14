import { NextResponse } from "next/server";
import { JwtServiceImpl } from "@infra/crypto/jwt.service";

const tokenService = new JwtServiceImpl();

export async function GET(): Promise<NextResponse> {
  try {
    const jwks = await tokenService.getJwksData();

    return NextResponse.json(jwks, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(
      "[JWKS] Failed to generate JWKS:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
