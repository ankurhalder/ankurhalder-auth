import { NextResponse } from "next/server";
import { getDatabase } from "@infra/database/connection";
import { getRedisClient } from "@infra/redis/client";

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, string> = {
    service: "ok",
    mongodb: "unknown",
    redis: "unknown",
  };

  let allHealthy = true;

  try {
    const db = await getDatabase();
    await db.command({ ping: 1 });
    checks.mongodb = "connected";
  } catch (error) {
    checks.mongodb = "disconnected";
    allHealthy = false;
    console.error(
      "[Health] MongoDB check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      checks.redis = "connected";
    } else {
      checks.redis = "disconnected";
      allHealthy = false;
    }
  } catch (error) {
    checks.redis = "disconnected";
    allHealthy = false;
    console.error(
      "[Health] Redis check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  const status = allHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
