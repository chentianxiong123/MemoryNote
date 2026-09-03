import type { Prisma, PrismaClient } from "@core/database";

export type KnowledgeClient = Pick<PrismaClient, "knowledgeCaptureBatch" | "knowledgeCaptureItem" | "wikiEntry">;

export type KnowledgeStatus = "PROPOSED" | "ACCEPTED" | "REJECTED" | "SNOOZED" | "MERGED" | "ARCHIVED";
export type KnowledgeKind = "ENTITY" | "RELATION" | "EVENT" | "DECISION";
export type RejectReason = "INACCURATE" | "IRRELEVANT" | "DUPLICATE" | "TRIVIAL" | "OTHER";

export interface InboxStats {
  proposedCount: number;
  snoozedCount: number;
  batchCount: number;
}

export async function getInboxStats(db: KnowledgeClient): Promise<InboxStats> {
  const [proposedCount, snoozedCount, batchCount] = await Promise.all([
    db.knowledgeCaptureItem.count({ where: { status: "PROPOSED" } }),
    db.knowledgeCaptureItem.count({ where: { status: "SNOOZED" } }),
    db.knowledgeCaptureBatch.count(),
  ]);
  return { proposedCount, snoozedCount, batchCount };
}

export interface InboxBatch {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  conversationId: string | null;
  sessionId: string;
  itemCount: number;
  proposedCount: number;
}

export async function listInboxBatches(
  db: KnowledgeClient,
  limit = 30,
): Promise<InboxBatch[]> {
  const batches = await db.knowledgeCaptureBatch.findMany({
    include: {
      items: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return batches.map((b) => ({
    id: b.id,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    conversationId: b.conversationId,
    sessionId: b.sessionId,
    itemCount: b.items.length,
    proposedCount: b.items.filter((i) => i.status === "PROPOSED").length,
  }));
}

export interface HomeData {
  reviewQueueCount: number;
  recentAcceptedCount: number;
  recentBatchCount: number;
  proposedLast14d: number;
}

export async function getKnowledgeHomeStats(db: KnowledgeClient): Promise<HomeData> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [reviewQueueCount, recentAcceptedCount, recentBatchCount, proposedLast14d] = await Promise.all([
    db.knowledgeCaptureItem.count({
      where: { status: { in: ["PROPOSED", "SNOOZED"] } },
    }),
    db.knowledgeCaptureItem.count({
      where: { status: { in: ["ACCEPTED", "MERGED"] } },
    }),
    db.knowledgeCaptureBatch.count(),
    db.knowledgeCaptureItem.count({
      where: { createdAt: { gte: cutoff } },
    }),
  ]);
  return { reviewQueueCount, recentAcceptedCount, recentBatchCount, proposedLast14d };
}

export async function snoozeItem(db: KnowledgeClient, itemId: string): Promise<void> {
  await db.knowledgeCaptureItem.update({
    where: { id: itemId },
    data: { status: "SNOOZED" },
  });
}

export async function rejectItem(
  db: KnowledgeClient,
  itemId: string,
  reason?: RejectReason,
): Promise<void> {
  await db.knowledgeCaptureItem.update({
    where: { id: itemId },
    data: { status: "REJECTED", rejectReason: reason ?? null },
  });
}

export async function archiveBatch(db: KnowledgeClient, batchId: string): Promise<void> {
  await db.knowledgeCaptureBatch.update({
    where: { id: batchId },
    data: { status: "ARCHIVED" },
  });
}

export type { Prisma };
