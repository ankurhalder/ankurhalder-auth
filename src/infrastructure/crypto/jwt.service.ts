import * as jose from "jose";
import crypto from "node:crypto";
import type {
  ITokenService,
  AccessTokenPayload,
  RefreshTokenPayload,
  GeneratedToken,
  JsonWebKeySet,
  JsonWebKey,
} from "@app/interfaces/token.service";
import { env } from "@/env";

const ALGORITHM = "RS256" as const;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Type alias for jose key material.
 * Since jose doesn't export KeyLike in this version, we define it explicitly.
 * Using 'any' to avoid conflicts between crypto.KeyObject and crypto.webcrypto.CryptoKey
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CryptoKey = any;

/**
 * Parsed key material, cached after first load.
 */
interface KeySet {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  kid: string;
}

let accessKeySet: KeySet | null = null;
let refreshKeySet: KeySet | null = null;
let previousKeys: Array<{
  publicKey: CryptoKey;
  kid: string;
}> = [];
let previousKeysExpiry: number = 0;

/**
 * Load and cache access token key pair.
 */
async function getAccessKeySet(): Promise<KeySet> {
  if (accessKeySet) return accessKeySet;

  const privateKey = await jose.importPKCS8(
    env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ALGORITHM
  );
  const publicKey = await jose.importSPKI(
    env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n"),
    ALGORITHM
  );

  accessKeySet = { privateKey, publicKey, kid: env.JWT_KID };
  return accessKeySet;
}

/**
 * Load and cache refresh token key pair.
 */
async function getRefreshKeySet(): Promise<KeySet> {
  if (refreshKeySet) return refreshKeySet;

  const privateKey = await jose.importPKCS8(
    env.JWT_REFRESH_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ALGORITHM
  );
  const publicKey = await jose.importSPKI(
    env.JWT_REFRESH_PUBLIC_KEY.replace(/\\n/g, "\n"),
    ALGORITHM
  );

  refreshKeySet = { privateKey, publicKey, kid: env.JWT_REFRESH_KID };
  return refreshKeySet;
}

/**
 * Load previous (rotated) public keys.
 * These are accepted for verification but never used for signing.
 * They expire 30 days after server start to ensure old tokens are eventually rejected.
 */
async function getPreviousKeys(): Promise<
  Array<{ publicKey: CryptoKey; kid: string }>
> {
  if (previousKeys.length > 0) return previousKeys;

  const kids = env.JWT_PREVIOUS_KIDS;
  const publicKeyPems = env.JWT_PREVIOUS_PUBLIC_KEYS;

  if (kids.length === 0 || publicKeyPems.length === 0) return [];
  if (kids.length !== publicKeyPems.length) {
    console.error(
      "[JWT] JWT_PREVIOUS_KIDS and JWT_PREVIOUS_PUBLIC_KEYS have different lengths"
    );
    return [];
  }

  previousKeys = await Promise.all(
    kids.map(async (kid, i) => {
      const pem = publicKeyPems[i]!;
      const publicKey = await jose.importSPKI(
        pem.replace(/\\n/g, "\n"),
        ALGORITHM
      );
      return { publicKey, kid };
    })
  );

  previousKeysExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

  return previousKeys;
}

/**
 * Find the public key for a given KID.
 * Searches current keys first, then previous (rotated) keys.
 */
async function findPublicKeyByKid(
  kid: string,
  type: "access" | "refresh"
): Promise<CryptoKey | null> {
  const current =
    type === "access" ? await getAccessKeySet() : await getRefreshKeySet();
  if (current.kid === kid) {
    return current.publicKey;
  }

  if (Date.now() < previousKeysExpiry) {
    const prev = await getPreviousKeys();
    const match = prev.find((k) => k.kid === kid);
    if (match) return match.publicKey;
  }

  return null;
}

/**
 * Generate a 128-bit hex JTI (JWT ID) for token revocation.
 */
function generateJti(): string {
  return crypto.randomBytes(16).toString("hex");
}

export class JwtServiceImpl implements ITokenService {
  async generateAccessToken(payload: {
    userId: string;
    email: string;
    role: "admin" | "user";
    sessionId: string;
    tokenVersion: number;
  }): Promise<GeneratedToken> {
    const { privateKey, kid } = await getAccessKeySet();
    const jti = generateJti();

    const token = await new jose.SignJWT({
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
      jti,
      tv: payload.tokenVersion,
    })
      .setProtectedHeader({ alg: ALGORITHM, kid })
      .setSubject(payload.userId)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey);

    return { token, jti };
  }

  async generateRefreshToken(payload: {
    userId: string;
    sessionId: string;
    tokenVersion: number;
    ttlSeconds: number;
  }): Promise<GeneratedToken> {
    const { privateKey, kid } = await getRefreshKeySet();
    const jti = generateJti();

    const token = await new jose.SignJWT({
      sessionId: payload.sessionId,
      jti,
      tv: payload.tokenVersion,
    })
      .setProtectedHeader({ alg: ALGORITHM, kid })
      .setSubject(payload.userId)
      .setIssuedAt()
      .setExpirationTime(`${payload.ttlSeconds}s`)
      .sign(privateKey);

    return { token, jti };
  }

  /**
   * Verify an access token — the complete 8-step verification chain.
   *
   * Steps:
   * 1. Parse JWT header (extract kid)
   * 2. Find public key by kid (current or previous)
   * 3. Verify signature + expiry via jose.jwtVerify
   * 4. Validate payload structure
   *
   * Steps 5-8 (revocation checks, DB user fetch) are performed
   * by the auth middleware, NOT here. This method only handles
   * cryptographic verification.
   *
   * Returns null on ANY failure (no partial auth state).
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const header = jose.decodeProtectedHeader(token);
      if (!header.kid || header.alg !== ALGORITHM) {
        return null;
      }

      const publicKey = await findPublicKeyByKid(header.kid, "access");
      if (!publicKey) {
        return null;
      }

      const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: [ALGORITHM],
      });

      if (
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.role !== "string" ||
        typeof payload.sessionId !== "string" ||
        typeof payload.jti !== "string" ||
        typeof payload.tv !== "number" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number"
      ) {
        return null;
      }

      if (payload.role !== "admin" && payload.role !== "user") {
        return null;
      }

      return {
        sub: payload.sub,
        email: payload.email as string,
        role: payload.role as "admin" | "user",
        sessionId: payload.sessionId as string,
        jti: payload.jti as string,
        tv: payload.tv as number,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const header = jose.decodeProtectedHeader(token);
      if (!header.kid || header.alg !== ALGORITHM) {
        return null;
      }

      const publicKey = await findPublicKeyByKid(header.kid, "refresh");
      if (!publicKey) {
        return null;
      }

      const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: [ALGORITHM],
      });

      if (
        typeof payload.sub !== "string" ||
        typeof payload.sessionId !== "string" ||
        typeof payload.jti !== "string" ||
        typeof payload.tv !== "number" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number"
      ) {
        return null;
      }

      return {
        sub: payload.sub,
        sessionId: payload.sessionId as string,
        jti: payload.jti as string,
        tv: payload.tv as number,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate JWKS data for the /.well-known/jwks.json endpoint.
   *
   * Includes:
   * - Current access token public key
   * - Current refresh token public key
   * - Previous (rotated) public keys (if not expired)
   */
  async getJwksData(): Promise<JsonWebKeySet> {
    const keys: JsonWebKey[] = [];

    const accessKeys = await getAccessKeySet();
    const accessJwk = await jose.exportJWK(accessKeys.publicKey);
    keys.push({
      kty: accessJwk.kty ?? "RSA",
      kid: accessKeys.kid,
      alg: ALGORITHM,
      use: "sig",
      n: accessJwk.n ?? "",
      e: accessJwk.e ?? "",
    });

    const refreshKeys = await getRefreshKeySet();
    const refreshJwk = await jose.exportJWK(refreshKeys.publicKey);
    keys.push({
      kty: refreshJwk.kty ?? "RSA",
      kid: refreshKeys.kid,
      alg: ALGORITHM,
      use: "sig",
      n: refreshJwk.n ?? "",
      e: refreshJwk.e ?? "",
    });

    if (Date.now() < previousKeysExpiry) {
      const prevKeys = await getPreviousKeys();
      for (const prev of prevKeys) {
        const jwk = await jose.exportJWK(prev.publicKey);
        keys.push({
          kty: jwk.kty ?? "RSA",
          kid: prev.kid,
          alg: ALGORITHM,
          use: "sig",
          n: jwk.n ?? "",
          e: jwk.e ?? "",
        });
      }
    }

    return { keys };
  }
}
