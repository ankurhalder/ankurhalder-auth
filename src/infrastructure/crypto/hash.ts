import crypto from "node:crypto";

export function sha256Hash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
