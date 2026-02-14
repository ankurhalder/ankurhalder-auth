import { createIndexes } from "@/infrastructure/database/indexes";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing auth service...");

    try {
      await createIndexes();
      console.log("[Instrumentation] Database indexes created successfully");

      console.log("[Instrumentation] Auth service ready");
    } catch (error) {
      console.error(
        "[Instrumentation] Failed to initialize:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
