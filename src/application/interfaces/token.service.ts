/**
 * JWT payload structure for access tokens.
 */
export interface AccessTokenPayload {
  /** User ID (MongoDB ObjectId as string) */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: "admin" | "user";
  /** Session UUID */
  sessionId: string;
  /** JWT ID (128-bit hex) for individual revocation */
  jti: string;
  /** Token version — must match user.tokenVersion */
  tv: number;
  /** Issued-at (Unix seconds) */
  iat: number;
  /** Expiry (Unix seconds) */
  exp: number;
}

/**
 * JWT payload structure for refresh tokens.
 */
export interface RefreshTokenPayload {
  /** User ID */
  sub: string;
  /** Session UUID */
  sessionId: string;
  /** JWT ID for individual revocation */
  jti: string;
  /** Token version */
  tv: number;
  /** Issued-at */
  iat: number;
  /** Expiry */
  exp: number;
}

/**
 * Result of token generation: both the raw JWT string and its JTI.
 */
export interface GeneratedToken {
  /** The signed JWT string */
  token: string;
  /** The JTI embedded in the token */
  jti: string;
}

/**
 * Port: JWT token service.
 * Handles signing (private key) and verification (public key).
 */
export interface ITokenService {
  /**
   * Generate an access token (15 min TTL).
   */
  generateAccessToken(payload: {
    userId: string;
    email: string;
    role: "admin" | "user";
    sessionId: string;
    tokenVersion: number;
  }): Promise<GeneratedToken>;

  /**
   * Generate a refresh token.
   * @param ttlSeconds 604800 (7 days) or 2592000 (30 days for rememberMe)
   */
  generateRefreshToken(payload: {
    userId: string;
    sessionId: string;
    tokenVersion: number;
    ttlSeconds: number;
  }): Promise<GeneratedToken>;

  /**
   * Verify an access token.
   * Returns the payload if valid, null if invalid for ANY reason.
   * MUST NOT throw — returns null on all failures.
   */
  verifyAccessToken(token: string): Promise<AccessTokenPayload | null>;

  /**
   * Verify a refresh token.
   * Returns the payload if valid, null if invalid.
   */
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null>;

  /**
   * Get JWKS data for the /.well-known/jwks.json endpoint.
   */
  getJwksData(): Promise<JsonWebKeySet>;
}

/**
 * Standard JWKS response format.
 */
export interface JsonWebKeySet {
  keys: JsonWebKey[];
}

export interface JsonWebKey {
  kty: string;
  kid: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}
