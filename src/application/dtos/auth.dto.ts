/**
 * Input/Output DTOs for authentication use cases.
 *
 * DTOs cross layer boundaries. They are plain objects (no methods, no validation).
 * Validation is performed by Zod schemas in the Presentation Layer before
 * the data reaches the use case.
 */

export interface SignupInput {
  email: string;
  password: string;
  name?: string;
}

export interface SignupOutput {
  success: true;
  message: string;
}

export interface SigninInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Signin has two possible outcomes:
 * 1. Standard user: authenticated immediately, tokens set
 * 2. Admin user: OTP required, no tokens yet
 */
export interface SigninOutputAuthenticated {
  isAuthenticated: true;
  requiresOtp: false;
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
    tier: "free" | "pro";
  };
  /** Access token string (also set as cookie) */
  accessToken: string;
  /** Refresh token string (also set as cookie) */
  refreshToken: string;
}

export interface SigninOutputOtpRequired {
  isAuthenticated: false;
  requiresOtp: true;
  otpSent: true;
  message: string;
}

export type SigninOutput = SigninOutputAuthenticated | SigninOutputOtpRequired;

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface VerifyOtpOutput {
  isAuthenticated: true;
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
    tier: "free" | "pro";
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  success: true;
  accessToken: string;
  refreshToken: string;
}

export interface LogoutInput {
  sessionId: string;
  userId: string;
}

export interface LogoutOutput {
  success: true;
  message: string;
}

export interface GlobalLogoutInput {
  userId: string;
}

export interface GlobalLogoutOutput {
  success: true;
  message: string;
  sessionsRevoked: number;
}

/**
 * Request context passed to all use cases for audit logging.
 * Extracted from the HTTP request by the presentation layer.
 */
export interface RequestContext {
  /** Unique request ID (UUID v4) for tracing */
  requestId: string;
  /** Client IP address */
  ipAddress: string;
  /** Raw User-Agent header */
  userAgent: string;
}
