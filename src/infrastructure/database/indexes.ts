import type { Db, IndexDescription } from "mongodb";
import { getDatabase } from "./connection";
import { USERS_COLLECTION } from "./schemas/user.schema";
import { SESSIONS_COLLECTION } from "./schemas/session.schema";
import { AUTH_EVENTS_COLLECTION } from "./schemas/auth-event.schema";

/**
 * Index definitions for all collections.
 * Each entry: [collectionName, indexes[]]
 */
const INDEX_DEFINITIONS: Array<{
  collection: string;
  indexes: IndexDescription[];
}> = [
  {
    collection: USERS_COLLECTION,
    indexes: [
      {
        key: { email: 1 },
        unique: true,
        name: "idx_email_unique",
      },
      {
        key: { verificationToken: 1 },
        sparse: true,
        name: "idx_verification_token",
      },
      {
        key: { verificationTokenHash: 1 },
        sparse: true,
        name: "idx_verification_token_hash",
      },
      {
        key: { passwordResetTokenHash: 1 },
        sparse: true,
        name: "idx_password_reset_token_hash",
      },
      {
        key: { role: 1 },
        name: "idx_role",
      },
      {
        key: { createdAt: -1 },
        name: "idx_created_at_desc",
      },
      {
        key: { email: 1, isVerified: 1 },
        name: "idx_email_verified",
      },
      {
        key: { tokenVersion: 1 },
        name: "idx_token_version",
      },
    ],
  },
  {
    collection: SESSIONS_COLLECTION,
    indexes: [
      {
        key: { userId: 1 },
        name: "idx_user_id",
      },
      {
        key: { sessionId: 1 },
        unique: true,
        name: "idx_session_id_unique",
      },
      {
        key: { refreshTokenHash: 1 },
        unique: true,
        name: "idx_refresh_token_hash_unique",
      },
      {
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
        name: "idx_expires_at_ttl",
      },
      {
        key: { userId: 1, expiresAt: -1 },
        name: "idx_user_id_expires_at",
      },
    ],
  },
  {
    collection: AUTH_EVENTS_COLLECTION,
    indexes: [
      {
        key: { timestamp: -1 },
        name: "idx_timestamp_desc",
      },
      {
        key: { userId: 1, timestamp: -1 },
        name: "idx_user_id_timestamp",
      },
      {
        key: { eventType: 1, timestamp: -1 },
        name: "idx_event_type_timestamp",
      },
      {
        key: { ipAddress: 1, timestamp: -1 },
        name: "idx_ip_address_timestamp",
      },
      {
        key: { sessionId: 1 },
        sparse: true,
        name: "idx_session_id",
      },
      {
        key: { timestamp: 1 },
        expireAfterSeconds: 7_776_000,
        name: "idx_timestamp_ttl_90d",
      },
    ],
  },
];

/**
 * Create all indexes for all collections.
 *
 * Called from instrumentation.ts on cold start.
 * Uses createIndexes (plural) for efficiency — one round trip per collection.
 *
 * Safe to call repeatedly: MongoDB's createIndexes is idempotent.
 * If an index already exists with the same key and options, it is a no-op.
 */
export async function createIndexes(): Promise<void> {
  const db = await getDatabase();

  for (const { collection, indexes } of INDEX_DEFINITIONS) {
    try {
      const result = await db.collection(collection).createIndexes(indexes);
      console.log(
        `[Indexes] ${collection}: ensured ${result.length} indexes — [${result.join(", ")}]`
      );
    } catch (error) {
      console.error(
        `[Indexes] Failed to create indexes for ${collection}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

/**
 * Drop all custom indexes (not _id) for a collection.
 * Used in tests and migration scripts.
 */
export async function dropIndexes(
  db: Db,
  collectionName: string
): Promise<void> {
  await db.collection(collectionName).dropIndexes();
}
