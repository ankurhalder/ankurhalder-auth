export interface AccessTokenPayload {
  sub: string;

  email: string;

  role: "admin" | "user";

  sessionId: string;

  jti: string;

  tv: number;

  iat: number;

  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;

  sessionId: string;

  jti: string;

  tv: number;

  iat: number;

  exp: number;
}

export interface GeneratedToken {
  token: string;

  jti: string;
}

export interface ITokenService {
  generateAccessToken(payload: {
    userId: string;
    email: string;
    role: "admin" | "user";
    sessionId: string;
    tokenVersion: number;
  }): Promise<GeneratedToken>;

  generateRefreshToken(payload: {
    userId: string;
    sessionId: string;
    tokenVersion: number;
    ttlSeconds: number;
  }): Promise<GeneratedToken>;

  verifyAccessToken(token: string): Promise<AccessTokenPayload | null>;

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null>;

  getJwksData(): Promise<JsonWebKeySet>;
}

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
