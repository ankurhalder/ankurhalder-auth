import { MongoClient, ServerApiVersion } from "mongodb";
import type { MongoClientOptions, Db } from "mongodb";
import { env } from "@/env";

const CLIENT_OPTIONS: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 10_000,

  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  serverSelectionTimeoutMS: 10_000,

  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },

  w: "majority",
  retryWrites: true,
  retryReads: true,

  compressors: ["zstd", "snappy", "zlib"],
};

/**
 * Circuit breaker state.
 *
 * Tracks consecutive failures to prevent avalanche of connection
 * attempts when MongoDB is down.
 *
 * States:
 * - CLOSED: normal operation, connections are attempted
 * - OPEN: too many failures, reject immediately
 * - HALF_OPEN: recovery period, allow one probe attempt
 */
interface CircuitBreakerState {
  failures: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  lastFailureTime: number;
  nextRetryTime: number;
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
} as const;

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  state: "CLOSED",
  lastFailureTime: 0,
  nextRetryTime: 0,
};

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionTimestamp: number = 0;

const CONNECTION_TTL_MS = 10 * 60 * 1000;

/**
 * Sanitize MongoDB connection errors to prevent leaking credentials.
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(
      /mongodb(\+srv)?:\/\/[^\s]+/g,
      "mongodb://[REDACTED]"
    );
  }
  return "Unknown database error";
}

/**
 * Check if the circuit breaker allows a connection attempt.
 */
function canAttemptConnection(): boolean {
  if (circuitBreaker.state === "CLOSED") return true;

  if (
    circuitBreaker.state === "OPEN" &&
    Date.now() >= circuitBreaker.nextRetryTime
  ) {
    circuitBreaker.state = "HALF_OPEN";
    return true;
  }

  return circuitBreaker.state === "HALF_OPEN";
}

/**
 * Record a successful connection — reset the circuit breaker.
 */
function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.state = "CLOSED";
  circuitBreaker.lastFailureTime = 0;
  circuitBreaker.nextRetryTime = 0;
}

/**
 * Record a connection failure — potentially open the circuit.
 */
function recordFailure(): void {
  circuitBreaker.failures += 1;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    circuitBreaker.state = "OPEN";
    circuitBreaker.nextRetryTime =
      Date.now() + CIRCUIT_BREAKER_CONFIG.recoveryTimeMs;

    console.error(
      `[MongoDB] Circuit breaker OPEN after ${circuitBreaker.failures} failures. ` +
        `Retry at ${new Date(circuitBreaker.nextRetryTime).toISOString()}`
    );
  }
}

/**
 * Get a connected MongoDB client and database reference.
 *
 * Features:
 * - Singleton: reuses the same client across requests within a serverless instance
 * - Circuit breaker: stops hammering a down database
 * - Connection TTL: reconnects after 10 minutes to pick up cluster changes
 * - Error sanitization: never leaks connection strings
 * - Pool monitoring: logs significant connection pool events
 *
 * @throws Error if connection fails and circuit breaker is open
 */
export async function getDatabase(): Promise<Db> {
  if (
    client &&
    db &&
    connectionTimestamp > 0 &&
    Date.now() - connectionTimestamp > CONNECTION_TTL_MS
  ) {
    console.warn("[MongoDB] Connection TTL exceeded, reconnecting...");
    await closeConnection();
  }

  if (client && db) {
    return db;
  }

  if (!canAttemptConnection()) {
    throw new Error(
      `Database connection refused: circuit breaker is ${circuitBreaker.state}. ` +
        `Retry after ${new Date(circuitBreaker.nextRetryTime).toISOString()}`
    );
  }

  try {
    client = new MongoClient(env.MONGODB_URI, CLIENT_OPTIONS);

    client.on("connectionPoolCreated", (event) => {
      console.log(`[MongoDB] Pool created: ${event.address}`);
    });

    client.on("connectionPoolCleared", (event) => {
      console.warn(`[MongoDB] Pool cleared: ${event.address}`);
    });

    client.on("connectionCheckOutFailed", (event) => {
      console.error(`[MongoDB] Connection checkout failed: ${event.reason}`);
    });

    await client.connect();

    db = client.db(env.DB_NAME);
    await db.command({ ping: 1 });

    connectionTimestamp = Date.now();
    recordSuccess();

    console.log(
      `[MongoDB] Connected to database "${env.DB_NAME}" successfully`
    );

    return db;
  } catch (error) {
    recordFailure();

    if (client) {
      try {
        await client.close();
      } catch {}
      client = null;
      db = null;
    }

    throw new Error(`Database connection failed: ${sanitizeError(error)}`);
  }
}

/**
 * Get a MongoDB collection with type safety.
 *
 * @example
 * const users = await getCollection<UserDocument>("platform_users");
 * const user = await users.findOne({ email: "user@example.com" });
 */
export async function getCollection<T extends Document>(
  name: string
): Promise<import("mongodb").Collection<T>> {
  const database = await getDatabase();
  return database.collection<T>(name);
}

/**
 * Close the MongoDB connection gracefully.
 * Called during shutdown or when connection TTL expires.
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch (error) {
      console.error(
        `[MongoDB] Error closing connection: ${sanitizeError(error)}`
      );
    } finally {
      client = null;
      db = null;
      connectionTimestamp = 0;
    }
  }
}
