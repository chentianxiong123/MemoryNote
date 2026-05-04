/**
 * Queue Adapter - Simplified
 *
 * Core functions: AI conversation, memory storage, vector search, knowledge graph
 */

import { prisma } from "~/db.server";
import { logger } from "~/services/logger.service";
import { processConversationTitleCreation } from "~/jobs/conversation/create-title.logic";
import { processEpisodePreprocessing } from "~/jobs/ingest/preprocess-episode.logic";
import { processEpisodeIngestion, type IngestEpisodePayload } from "~/jobs/ingest/ingest-episode.logic";
import { processGraphResolution } from "~/jobs/ingest/graph-resolution.logic";

export type QueueProvider = "trigger" | "bullmq";

function runDetached(taskName: string, task: () => Promise<void>) {
  void task().catch((error) => {
    logger.error(`[queue-adapter] ${taskName} failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function enqueuePreprocessEpisode(
  payload: { queueId: string; userId: string; workspaceId: string; body: unknown },
  delay?: boolean,
): Promise<{ id?: string }> {
  runDetached("preprocess-episode", async () => {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
    }

    await processEpisodePreprocessing(
      payload as IngestEpisodePayload,
      async (params) => {
        await enqueueIngestEpisode(params);
      },
    );
  });

  return { id: payload.queueId };
}

export async function enqueueIngestEpisode(
  payload: { queueId: string; userId: string; workspaceId: string; body: unknown },
): Promise<{ id?: string }> {
  runDetached("ingest-episode", async () => {
    await processEpisodeIngestion(
      payload as IngestEpisodePayload,
      undefined,
      undefined,
      undefined,
      async (params) => {
        await enqueueGraphResolution({
          episodeUuid: params.episodeUuid,
          userId: params.userId,
          workspaceId: params.workspaceId,
          queueId: params.queueId,
          episodeDetails: params.episodeDetails,
        } as any);
      },
    );
  });

  return { id: payload.queueId };
}

export async function enqueueCreateConversationTitle(
  payload: { conversationId: string; conversationHistoryId: string },
): Promise<{ id?: string }> {
  runDetached("create-conversation-title", async () => {
    const history = await prisma.conversationHistory.findUnique({
      where: { id: payload.conversationHistoryId },
      select: { message: true, parts: true },
    });

    const parts = Array.isArray(history?.parts) ? history.parts : [];
    const messageFromParts = parts
      .filter((part: any) => part?.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();

    const message = messageFromParts || history?.message || "";
    if (!message) return;

    await processConversationTitleCreation({
      conversationId: payload.conversationId,
      message,
    });
  });

  return { id: payload.conversationId };
}

export async function enqueueGraphResolution(
  payload: {
    episodeUuid: string;
    userId: string;
    workspaceId?: string;
    queueId?: string;
    episodeDetails?: unknown;
  },
): Promise<{ id?: string }> {
  runDetached("graph-resolution", async () => {
    if (!payload.workspaceId) {
      logger.warn("[queue-adapter] graph-resolution skipped: missing workspaceId", {
        episodeUuid: payload.episodeUuid,
      });
      return;
    }

    await processGraphResolution({
      episodeUuid: payload.episodeUuid,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      queueId: payload.queueId,
      episodeDetails: payload.episodeDetails as any,
    });
  });

  return { id: `resolution-${payload.episodeUuid}` };
}

export async function enqueueActivityCase(
  payload: { activityId: string; userId: string; workspaceId: string },
): Promise<{ id?: string }> {
  return { id: `activity-${payload.activityId}` };
}

export const isTriggerDeployment = () => false;
