/**
 * All event types tracked by the audit log.
 */
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

/**
 * AuthEvent entity. Represents a single auditable authentication event.
 *
 * Events are written fire-and-forget: failures to write an audit event
 * MUST NOT block or fail the primary auth operation.
 *
 * Events are auto-deleted after 90 days via TTL index on the `timestamp` field.
 */
export interface AuthEventEntity {
  /** MongoDB ObjectId as string */
  readonly id: string;

  /** The type of event that occurred */
  eventType: AuthEventType;

  /** The user involved, if applicable (not set for failed signins by unknown email) */
  userId?: string;

  /** The email involved (always set for login attempts, useful when userId unknown) */
  email?: string;

  /** Session ID if the event is session-scoped */
  sessionId?: string;

  /** Client IP address */
  ipAddress?: string;

  /** Raw User-Agent header */
  userAgent?: string;

  /** When the event occurred */
  timestamp: Date;

  /** Whether the operation succeeded */
  success: boolean;

  /** Human-readable failure reason (only on failure) */
  failureReason?: string;

  /**
   * Arbitrary metadata for the event.
   * Examples:
   * - { rememberMe: true } for SIGNIN
   * - { reason: "password_change" } for GLOBAL_LOGOUT
   * - { subject: "Hello" } for CONTACT_FORM_SUBMITTED
   */
  metadata?: Record<string, unknown>;

  /**
   * Service identifier. Always "auth-service" for this service.
   * Future-proofs for multi-service audit aggregation.
   */
  serviceId: string;

  /**
   * Unique request identifier (UUID v4) for tracing.
   * Correlates the event to a specific HTTP request.
   */
  requestId: string;
}
