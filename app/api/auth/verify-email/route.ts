import { type NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { VerifyEmailUseCase } from "@/application/use-cases/verify-email.use-case";
import { UserRepositoryImpl } from "@/infrastructure/database/user.repository.impl";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { AuthEventRepositoryImpl } from "@/infrastructure/database/auth-event.repository.impl";
import { JwtServiceImpl } from "@/infrastructure/crypto/jwt.service";
import { withCors } from "@/presentation/middleware/cors";
import {
  errorResponse,
  successResponse,
} from "@/presentation/helpers/response";
import { buildRequestContext } from "@/presentation/helpers/request-context";
import { setAuthCookies } from "@/presentation/helpers/cookies";
import { VerifyEmailSchema } from "@/presentation/validation/schemas";
import { ValidationError } from "@/domain/errors/validation.error";
import { sha256Hash } from "@/infrastructure/crypto/hash";

async function verifyEmailHandler(request: NextRequest): Promise<Response> {
  const context = buildRequestContext(request);

  try {
    let token: string | null = null;

    if (request.method === "GET") {
      token = request.nextUrl.searchParams.get("token");
    } else if (request.method === "POST") {
      const body: unknown = await request.json();
      const bodyObj = body as Record<string, unknown>;
      token = bodyObj.token as string | null;
    }

    const validationResult = VerifyEmailSchema.safeParse({ token });
    if (!validationResult.success) {
      const fields = validationResult.error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );
      throw new ValidationError("Invalid verification data", fields);
    }

    const { token: verifiedToken } = validationResult.data;

    const userRepository = new UserRepositoryImpl();
    const authEventRepository = new AuthEventRepositoryImpl();
    const sessionRepository = new SessionRepositoryImpl();
    const tokenService = new JwtServiceImpl();

    const verifyEmailUseCase = new VerifyEmailUseCase(
      userRepository,
      authEventRepository
    );

    const result = await verifyEmailUseCase.execute(
      { token: verifiedToken },
      context
    );

    const sessionId = uuidv4();
    const ttlSeconds = 7 * 24 * 60 * 60;

    const [accessResult, refreshResult] = await Promise.all([
      tokenService.generateAccessToken({
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role as "admin" | "user",
        sessionId,
        tokenVersion: result.user.tokenVersion,
      }),
      tokenService.generateRefreshToken({
        userId: result.user.id,
        sessionId,
        tokenVersion: result.user.tokenVersion,
        ttlSeconds,
      }),
    ]);

    const refreshTokenHash = sha256Hash(refreshResult.token);

    await sessionRepository.create({
      sessionId,
      userId: result.user.id,
      refreshTokenHash,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      lastUsedAt: new Date(),
    });

    const response = successResponse(
      {
        message: "Email verified successfully. You are now logged in.",
        user: result.user,
      },
      200
    );

    setAuthCookies(response, accessResult.token, refreshResult.token, false);

    return response;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new Error(String(error)),
      context.requestId
    );
  }
}

export const GET = withCors(verifyEmailHandler);
export const POST = withCors(verifyEmailHandler);
