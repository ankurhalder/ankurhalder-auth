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

export interface SigninOutputAuthenticated {
  isAuthenticated: true;
  requiresOtp: false;
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
    tier: "free" | "pro";
  };

  accessToken: string;

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

export interface RequestContext {
  requestId: string;

  ipAddress: string;

  userAgent: string;
}
