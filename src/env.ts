import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://www.ankurhalder.com"),
  ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()))
    .default("https://www.ankurhalder.com,https://ankurhalder.com"),

  JWT_PRIVATE_KEY: z
    .string()
    .min(100, "JWT_PRIVATE_KEY must be a PEM-encoded RSA private key"),
  JWT_PUBLIC_KEY: z
    .string()
    .min(100, "JWT_PUBLIC_KEY must be a PEM-encoded RSA public key"),
  JWT_KID: z.string().default("k1"),

  JWT_REFRESH_PRIVATE_KEY: z
    .string()
    .min(100, "JWT_REFRESH_PRIVATE_KEY must be a PEM-encoded RSA private key"),
  JWT_REFRESH_PUBLIC_KEY: z
    .string()
    .min(100, "JWT_REFRESH_PUBLIC_KEY must be a PEM-encoded RSA public key"),
  JWT_REFRESH_KID: z.string().default("r1"),

  JWT_PREVIOUS_KIDS: z
    .string()
    .transform((s) => (s ? s.split(",").map((k) => k.trim()) : []))
    .default(""),
  JWT_PREVIOUS_PUBLIC_KEYS: z
    .string()
    .transform((s) => (s ? s.split(",").map((k) => k.trim()) : []))
    .default(""),

  MONGODB_URI: z
    .string()
    .startsWith(
      "mongodb",
      "MONGODB_URI must be a valid MongoDB connection string"
    ),
  DB_NAME: z.string().default("portfolio"),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  BREVO_API_KEY: z.string().min(1, "BREVO_API_KEY is required"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  FROM_EMAIL: z.string().email("FROM_EMAIL must be a valid email"),

  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"),

  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
});

function validateEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(`\n❌ Environment validation failed:\n${formatted}\n`);
    throw new Error("Invalid environment variables. See above for details.");
  }

  return result.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;
