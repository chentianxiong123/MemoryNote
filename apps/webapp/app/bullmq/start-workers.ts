/**
 * BullMQ Worker Startup Script - Simplified
 *
 * Core functions only: AI conversation, memory storage, vector search, knowledge graph
 */

import { logger } from "~/services/logger.service";
import { placeholderWorker, closeAllWorkers } from "./workers";
import { setupWorkerLogging } from "./utils/worker-logger";
import { placeholderQueue } from "./queues";
import { ProviderFactory } from "@core/providers";
import { prisma } from "~/db.server";

let metricsInterval: NodeJS.Timeout | null = null;

export async function initWorkers(): Promise<void> {
  setupWorkerLogging(placeholderWorker, placeholderQueue, "placeholder");

  logger.log("\n🚀 Starting BullMQ workers (simplified mode)...");
  logger.log("─".repeat(50));
  logger.log("✓ Placeholder worker ready");
  logger.log("─".repeat(50));
  logger.log("✅ Workers started");
}

export async function shutdownWorkers(): Promise<void> {
  logger.log("Shutdown signal received, closing workers gracefully...");
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }
  await closeAllWorkers();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ProviderFactory.initializeFromEnv({ prisma });
  logger.info("ProviderFactory initialized for standalone BullMQ workers");

  initWorkers();

  const shutdown = async () => {
    await shutdownWorkers();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
