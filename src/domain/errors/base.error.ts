/**
 * Base class for all domain errors.
 * Extends the native Error with a machine-readable code.
 *
 * The presentation layer maps error codes to HTTP status codes.
 */
export abstract class DomainError extends Error {
  /**
   * Machine-readable error code (e.g., "AUTHENTICATION_ERROR").
   * Used in API responses and for programmatic error handling.
   */
  abstract readonly code: string;

  /**
   * HTTP status code suggestion for the presentation layer.
   * The presentation layer may override this.
   */
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a serializable representation for API responses.
   * Never exposes stack traces in production.
   */
  toJSON(): { code: string; message: string } {
    return {
      code: this.code,
      message: this.message,
    };
  }
}
