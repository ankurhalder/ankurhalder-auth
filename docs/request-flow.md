# Request Flow Documentation

Complete documentation of the request lifecycle from HTTP request to response, including middleware chain, use case execution, and error handling.

## Table of Contents

- [Complete Request Lifecycle](#complete-request-lifecycle)
- [Middleware Chain](#middleware-chain)
- [Use Case Execution Flow](#use-case-execution-flow)
- [Error Handling Flow](#error-handling-flow)
- [Response Formatting](#response-formatting)
- [Cookie Management](#cookie-management)
- [Token Verification Steps](#token-verification-steps)

## Complete Request Lifecycle

### Overview Diagram

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ HTTP Request (POST /api/auth/signup)
     │ Headers: Origin, User-Agent, Content-Type
     │ Body: { email, password }
     │
     ↓
┌──────────────────────────────────────────────────────┐
│            Presentation Layer (Route Handler)        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [1] Middleware Chain                               │
│      ├─→ CORS Validation                            │
│      ├─→ Rate Limiting                              │
│      ├─→ CSRF Validation (if needed)                │
│      └─→ Auth Validation (for protected routes)     │
│                                                      │
│  [2] Request Parsing & Validation                   │
│      ├─→ Parse JSON body                            │
│      ├─→ Validate with Zod schema                   │
│      └─→ Build request context (IP, User-Agent, ID) │
│                                                      │
│  [3] Dependency Injection                           │
│      ├─→ Get MongoDB connection                     │
│      ├─→ Create repository instances                │
│      ├─→ Create service instances                   │
│      └─→ Wire use case with dependencies            │
│                                                      │
└──────────────┬───────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│              Application Layer (Use Case)            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [4] Use Case Execution                             │
│      ├─→ Validate business rules                    │
│      ├─→ Load domain entities from repositories     │
│      ├─→ Execute domain logic                       │
│      ├─→ Call infrastructure services               │
│      └─→ Save changes via repositories              │
│                                                      │
└──────────────┬───────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│        Infrastructure Layer (Repositories)           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [5] Data Persistence                               │
│      ├─→ Map domain entities to DB schemas          │
│      ├─→ Execute MongoDB operations                 │
│      ├─→ Execute Redis operations                   │
│      ├─→ Send emails (fire-and-forget)              │
│      └─→ Map DB schemas to domain entities          │
│                                                      │
└──────────────┬───────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│            Presentation Layer (Response)             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [6] Response Formatting                            │
│      ├─→ Format success/error response              │
│      ├─→ Set cookies (if applicable)                │
│      ├─→ Set headers (rate limit, security)         │
│      └─→ Return NextResponse                        │
│                                                      │
└──────────────┬───────────────────────────────────────┘
               │
               │ HTTP Response (201 Created)
               │ Headers: Set-Cookie, X-RateLimit-*
               │ Body: { success: true, data: {...} }
               │
               ↓
          ┌─────────┐
          │ Client  │
          └─────────┘
```

### Step-by-Step Breakdown

#### Step 1: Middleware Chain

Middleware are applied in order:

```typescript
// app/api/auth/signup/route.ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1a. CORS Validation
    const corsResult = await corsMiddleware(request);
    if (corsResult) return corsResult; // Early return if CORS fails

    // 1b. Rate Limiting
    const rateLimitResult = await rateLimitMiddleware(request);
    if (rateLimitResult) return rateLimitResult; // Early return if rate limited

    // 1c. CSRF (for state-changing operations)
    const csrfResult = await csrfMiddleware(request);
    if (csrfResult) return csrfResult;

    // Continue to step 2...
  } catch (error) {
    return handleDomainError(error);
  }
}
```

#### Step 2: Request Parsing & Validation

```typescript
// 2a. Parse request body
const body = await request.json();

// 2b. Validate with Zod
const input = SignupSchema.parse(body);
// Throws ZodError if invalid

// 2c. Build request context
const context = buildRequestContext(request);
// Returns: { ip, userAgent, requestId }
```

#### Step 3: Dependency Injection

```typescript
// 3a. Get infrastructure
const db = await getDatabase();
const redis = getRedisClient();

// 3b. Create repositories
const userRepository = new UserRepositoryImpl(db);
const authEventRepository = new AuthEventRepositoryImpl(db);

// 3c. Create services
const passwordService = new PasswordService();
const emailProvider = new BrevoEmailProvider(env.BREVO_API_KEY);

// 3d. Create use case
const useCase = new SignupUseCase(
  userRepository,
  passwordService,
  emailProvider,
  authEventRepository
);
```

#### Step 4: Use Case Execution

```typescript
// 4. Execute use case
const output = await useCase.execute({
  ...input,
  context,
});

// Use case handles:
// - Business validation
// - Entity creation
// - Repository calls
// - Email sending
// - Event logging
```

#### Step 5: Data Persistence

```typescript
// Inside use case...

// 5a. Save user
await this.userRepository.save(user);
// → Maps User entity to MongoDB schema
// → Executes insertOne()
// → Returns void

// 5b. Send email (fire-and-forget)
this.emailProvider
  .sendVerificationEmail(email, token)
  .catch((err) => console.error("Email failed:", err));
// → Does not block response
// → Retries with exponential backoff

// 5c. Log event
await this.authEventRepository.logEvent({
  eventType: "signup",
  email,
  ...context,
});
```

#### Step 6: Response Formatting

```typescript
// 6a. Format response
const response = successResponse(output, 201);

// 6b. Set cookies (if applicable)
if (output.accessToken) {
  setAuthCookies(response, output.accessToken, output.refreshToken);
}

// 6c. Return
return response;
```

## Middleware Chain

### Execution Order

```
Request
  ↓
CORS Middleware
  ↓
Rate Limit Middleware
  ↓
CSRF Middleware
  ↓
Auth Middleware (protected routes only)
  ↓
Route Handler
```

### 1. CORS Middleware

**Purpose:** Validate request origin against allowed origins

**Implementation:**

```typescript
// src/presentation/middleware/cors.ts
export async function corsMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const origin = request.headers.get("origin");
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",");

  // Check if origin is allowed
  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CORS_ERROR",
          message: "Origin not allowed",
        },
      },
      { status: 403 }
    );
  }

  // Return null to continue
  return null;
}
```

**Headers Set:**

- `Access-Control-Allow-Origin`: Matched origin or `*`
- `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE`
- `Access-Control-Allow-Headers`: `Content-Type, Authorization`
- `Access-Control-Allow-Credentials`: `true`

### 2. Rate Limit Middleware

**Purpose:** Prevent abuse by limiting requests per time window

**Implementation:**

```typescript
// src/presentation/middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";

export async function rateLimitMiddleware(
  request: NextRequest,
  limit: number,
  window: string
): Promise<NextResponse | null> {
  const ip = getClientIp(request);

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
  });

  const { success, limit: max, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          retryAfter: reset,
        },
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": max.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  return null; // Continue
}
```

**Rate Limits:**

- Signup: 5/hour
- Signin: 10/15min
- Forgot Password: 3/hour
- Resend Verification: 3/hour

### 3. CSRF Middleware

**Purpose:** Prevent cross-site request forgery attacks

**Implementation:**

```typescript
// src/presentation/middleware/csrf.ts
export async function csrfMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Validate origin header
  if (!origin) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CSRF_ERROR",
          message: "Missing origin header",
        },
      },
      { status: 403 }
    );
  }

  // Ensure origin matches host
  const originHost = new URL(origin).host;
  if (originHost !== host) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CSRF_ERROR",
          message: "Origin mismatch",
        },
      },
      { status: 403 }
    );
  }

  return null;
}
```

### 4. Auth Middleware (Protected Routes)

**Purpose:** Verify JWT access token for protected endpoints

**Implementation:**

```typescript
// src/presentation/middleware/auth.ts
export async function authMiddleware(request: NextRequest): Promise<
  | {
      userId: string;
      email: string;
      role: string;
    }
  | NextResponse
> {
  try {
    // 1. Extract token from cookie
    const token = request.cookies.get("accessToken")?.value;
    if (!token) {
      throw new AuthenticationError("No access token provided");
    }

    // 2-8. Verify token (see Token Verification Steps below)
    const payload = await jwtService.verifyAccessToken(token);

    // 3. Check revocation
    const isRevoked = await revocationStore.isTokenRevoked(payload.jti);
    if (isRevoked) {
      throw new TokenError("Token revoked");
    }

    // 4. Return user info
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      { status: 401 }
    );
  }
}
```

## Use Case Execution Flow

### Generic Use Case Pattern

```typescript
export class UseCase<TInput, TOutput> {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: TInput): Promise<TOutput> {
    // 1. Validate input (business rules)
    this.validateInput(input);

    // 2. Load entities from repositories
    const entity = await this.repository.find(...);

    // 3. Execute domain logic
    const result = entity.someBusinessMethod();

    // 4. Call infrastructure services
    await this.service.doSomething();

    // 5. Save changes
    await this.repository.save(result);

    // 6. Return output
    return this.buildOutput(result);
  }

  private validateInput(input: TInput): void {
    // Business validation
    if (!this.isValid(input)) {
      throw new ValidationError('Invalid input');
    }
  }

  private buildOutput(result: any): TOutput {
    // Map to DTO
    return { /* ... */ };
  }
}
```

### Example: Signin Use Case

```typescript
export class SigninUseCase {
  async execute(input: SigninInput): Promise<SigninOutput> {
    // 1. Find user
    const user = await this.userRepository.findByEmail(new Email(input.email));
    if (!user) {
      throw new AuthenticationError("Invalid credentials");
    }

    // 2. Check email verified
    if (!user.isVerified) {
      throw new AuthenticationError("Email not verified");
    }

    // 3. Verify password
    const isValid = await this.passwordService.verify(
      input.password,
      user.password
    );
    if (!isValid) {
      throw new AuthenticationError("Invalid credentials");
    }

    // 4. Check if admin (OTP path)
    if (user.role === "admin") {
      return await this.handleAdminFlow(user, input.context);
    }

    // 5. Create session (user path)
    const session = await this.createSession(user, input.rememberMe);

    // 6. Generate tokens
    const { accessToken, refreshToken } =
      await this.tokenService.generateTokens(user, session);

    // 7. Log event
    await this.authEventRepository.logEvent({
      eventType: "signin",
      userId: user.id,
      ...input.context,
    });

    // 8. Return output
    return {
      user: this.mapUserToDTO(user),
      accessToken,
      refreshToken,
      requiresOtp: false,
    };
  }
}
```

## Error Handling Flow

### Error Hierarchy

```
Error (Native)
  ↓
DomainError (Base)
  ├─→ ValidationError
  ├─→ AuthenticationError
  ├─→ AuthorizationError
  ├─→ NotFoundError
  ├─→ ConflictError
  ├─→ TokenError
  └─→ RateLimitError
```

### Error to HTTP Status Mapping

```typescript
// src/presentation/helpers/response.ts
export function mapDomainErrorToHttp(error: Error): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorizationError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof TokenError) return 401;

  // Unknown error
  return 500;
}
```

### Error Response Format

```typescript
export function errorResponse(error: Error): NextResponse {
  const status = mapDomainErrorToHttp(error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.name.replace("Error", "").toUpperCase(),
        message: error.message,
      },
    },
    { status }
  );
}
```

### Error Handling in Route

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ... middleware, validation, use case execution
    return successResponse(output, 201);
  } catch (error) {
    // Log error (in production, use proper logging)
    console.error("Signup error:", error);

    // Return formatted error response
    return handleDomainError(error);
  }
}
```

## Response Formatting

### Success Response

```typescript
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}
```

**Example:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123",
      "email": "user@example.com",
      "role": "user"
    },
    "message": "Signed in successfully"
  }
}
```

### Error Response

```typescript
export function errorResponse(
  error: Error,
  status: number = 500
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: getErrorCode(error),
        message: error.message,
      },
    },
    { status }
  );
}
```

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid credentials"
  }
}
```

## Cookie Management

### Setting Auth Cookies

```typescript
// src/presentation/helpers/cookies.ts
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean = false
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const domain = isProduction ? ".ankurhalder.com" : undefined;

  // Access token cookie (15 minutes)
  response.cookies.set("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain,
    path: "/",
    maxAge: 15 * 60, // 15 minutes
  });

  // Refresh token cookie (7 or 30 days)
  const refreshMaxAge = rememberMe
    ? 30 * 24 * 60 * 60 // 30 days
    : 7 * 24 * 60 * 60; // 7 days

  response.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain,
    path: "/",
    maxAge: refreshMaxAge,
  });
}
```

### Clearing Auth Cookies

```typescript
export function clearAuthCookies(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === "production";
  const domain = isProduction ? ".ankurhalder.com" : undefined;

  response.cookies.set("accessToken", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain,
    path: "/",
    maxAge: 0, // Immediate expiry
  });

  response.cookies.set("refreshToken", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain,
    path: "/",
    maxAge: 0,
  });
}
```

## Token Verification Steps

### 8-Step Verification Chain

When a protected endpoint is accessed, the access token undergoes 8 verification steps:

```typescript
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  // Step 1: JWT Signature Verification
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: env.NEXT_PUBLIC_SITE_URL,
  });
  // Throws if signature invalid or expired

  // Step 2: Token Type Check
  if (payload.type !== "access") {
    throw new TokenError("Invalid token type");
  }

  // Step 3: JTI Validation
  if (!payload.jti || typeof payload.jti !== "string") {
    throw new TokenError("Missing or invalid JTI");
  }

  // Step 4: Token-Level Revocation Check
  const isTokenRevoked = await redis.get(`revoke:token:${payload.jti}`);
  if (isTokenRevoked) {
    throw new TokenError("Token revoked");
  }

  // Step 5: Session-Level Revocation Check (if sessionId present)
  if (payload.sessionId) {
    const isSessionRevoked = await redis.get(
      `revoke:session:${payload.sessionId}`
    );
    if (isSessionRevoked) {
      throw new TokenError("Session revoked");
    }
  }

  // Step 6: User-Level Revocation Check
  const userRevokedAt = await redis.get(`revoke:user:${payload.sub}`);
  if (userRevokedAt) {
    const tokenIssuedAt = payload.iat * 1000; // Convert to ms
    const revokedTimestamp = parseInt(userRevokedAt);

    if (tokenIssuedAt < revokedTimestamp) {
      throw new TokenError("User revoked all tokens");
    }
  }

  // Step 7: User Exists Check
  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Step 8: Token Version Check
  if (payload.tokenVersion !== user.tokenVersion.value) {
    throw new TokenError("Token version mismatch");
  }

  // All checks passed
  return payload as AccessTokenPayload;
}
```

### Verification Steps Summary

1. **JWT Signature Verification**: Verify RS256 signature with public key
2. **Token Type Check**: Ensure token type is "access"
3. **JTI Validation**: Validate JWT ID is present
4. **Token-Level Revocation**: Check if specific token revoked
5. **Session-Level Revocation**: Check if session revoked
6. **User-Level Revocation**: Check if all user tokens revoked
7. **User Exists**: Verify user still exists in database
8. **Token Version**: Verify token version matches user's current version

All steps must pass for token to be valid.

---

## Summary

Request flow overview:

1. **Middleware Chain**: CORS → Rate Limit → CSRF → Auth
2. **Request Parsing**: JSON → Zod validation → Context building
3. **Dependency Injection**: Wire repositories and services
4. **Use Case Execution**: Business logic orchestration
5. **Data Persistence**: MongoDB + Redis operations
6. **Response Formatting**: Success/error responses with cookies

**Key Principles:**

- Middleware runs in sequence with early returns
- Use cases are framework-agnostic
- Errors are mapped to HTTP status codes
- Cookies are HttpOnly, Secure, SameSite=Lax
- Token verification is comprehensive (8 steps)

For implementation details, see:

- [Architecture](architecture.md)
- [Features](features.md)
- [Security Headers](features.md#security-headers)
