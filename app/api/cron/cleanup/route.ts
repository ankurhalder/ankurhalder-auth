/**
 * Cleanup Cron Job Route Handler
 *
 * POST /api/cron/cleanup
 * Authorization: Bearer {CRON_SECRET}
 *
 * Deletes expired sessions from database.
 * Should be called periodically via Vercel Cron or external scheduler.
 */

import { type NextRequest, NextResponse } from "next/server";
import { SessionRepositoryImpl } from "@/infrastructure/database/session.repository.impl";
import { env } from "@/env";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (!providedSecret || providedSecret !== env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionRepository = new SessionRepositoryImpl();
    const deletedCount = await sessionRepository.deleteExpiredSessions();

    return NextResponse.json({
      success: true,
      message: "Cleanup completed",
      stats: {
        sessionsDeleted: deletedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
