export type AuthEventType =
  | "SIGNUP"
  | "SIGNIN"
  | "SIGNIN_FAILED"
  | "OTP_SENT"
  | "OTP_VERIFIED"
  | "OTP_FAILED"
  | "TOKEN_REFRESH"
  | "TOKEN_REFRESH_FAILED"
  | "LOGOUT"
  | "GLOBAL_LOGOUT"
  | "EMAIL_VERIFIED"
  | "EMAIL_VERIFICATION_FAILED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_RESET_FAILED"
  | "VERIFICATION_RESENT"
  | "CONTACT_FORM_SUBMITTED"
  | "RATE_LIMITED"
  | "TOKEN_REVOKED"
  | "SESSION_REVOKED"
  | "SUSPICIOUS_ACTIVITY";

export interface AuthEventEntity {
  readonly id: string;

  eventType: AuthEventType;

  userId?: string;

  email?: string;

  sessionId?: string;

  ipAddress?: string;

  userAgent?: string;

  timestamp: Date;

  success: boolean;

  failureReason?: string;

  metadata?: Record<string, unknown>;

  serviceId: string;

  requestId: string;
}
