/**
 * BullMQ Queues - Simplified
 *
 * Core functions: AI conversation, memory storage, vector search, knowledge graph
 */

import { Queue } from "bullmq";
import { getRedisConnection } from "../connection";

export const placeholderQueue = new Queue("placeholder-queue", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: { age: 86400 },
  },
});

export const ingestQueue = new Queue("ingest-queue", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});

export const preprocessQueue = new Queue("preprocess-queue", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});

export const graphResolutionQueue = new Queue("graph-resolution-queue", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});

export const conversationTitleQueue = new Queue("conversation-title-queue", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});
