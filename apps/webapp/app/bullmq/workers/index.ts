/**
 * BullMQ Workers - Simplified for personal use
 *
 * Only conversation title creation is kept.
 * Other background jobs (ingest, reminders, tasks, etc.) have been removed.
 */

import { Worker } from "bullmq";
import { getRedisConnection } from "../connection";
import { logger } from "~/services/logger.service";
import { env } from "~/env.server";

// Placeholder worker - does nothing but keeps the system running
export const placeholderWorker = new Worker(
  "placeholder-queue",
  async (job) => {
    logger.info(`Processing placeholder job: ${job.id}`);
    return { success: true };
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

/**
 * Graceful shutdown handler
 */
export async function closeAllWorkers(): Promise<void> {
  await placeholderWorker.close();
  logger.log("All BullMQ workers closed");
}
