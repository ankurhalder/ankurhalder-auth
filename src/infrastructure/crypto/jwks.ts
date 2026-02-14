import { exportJWK, type JWK } from "jose";
import { env } from "@/env";

export interface JsonWebKeySet {
  keys: JWK[];
}

export async function getJwksData(): Promise<JsonWebKeySet> {
  const [accessPublicKey, refreshPublicKey] = await Promise.all([
    crypto.subtle.importKey(
      "spki",
      Buffer.from(
        env.JWT_PUBLIC_KEY.replace(
          /-----BEGIN PUBLIC KEY-----|\n|-----END PUBLIC KEY-----/g,
          ""
        ),
        "base64"
      ),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"]
    ),
    crypto.subtle.importKey(
      "spki",
      Buffer.from(
        env.JWT_REFRESH_PUBLIC_KEY.replace(
          /-----BEGIN PUBLIC KEY-----|\n|-----END PUBLIC KEY-----/g,
          ""
        ),
        "base64"
      ),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"]
    ),
  ]);

  const [accessJwk, refreshJwk] = await Promise.all([
    exportJWK(accessPublicKey),
    exportJWK(refreshPublicKey),
  ]);

  return {
    keys: [
      {
        ...accessJwk,
        kid: "access-token-key",
        alg: "RS256",
        use: "sig",
      },
      {
        ...refreshJwk,
        kid: "refresh-token-key",
        alg: "RS256",
        use: "sig",
      },
    ],
  };
}
