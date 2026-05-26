-- CreateEnum
CREATE TYPE "RejectReason" AS ENUM ('INACCURATE', 'IRRELEVANT', 'DUPLICATE', 'TRIVIAL', 'OTHER');

-- CreateEnum (used by KnowledgeCaptureBatch/Item below, may already exist)
DO $$ BEGIN
  CREATE TYPE "KnowledgeCaptureBatchStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KnowledgeCaptureItemKind" AS ENUM ('ENTITY', 'STATEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "KnowledgeCaptureItemStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'SNOOZED', 'MERGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: KnowledgeCaptureBatch
CREATE TABLE "KnowledgeCaptureBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "KnowledgeCaptureBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "sourceEpisodeUuids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeCaptureBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: KnowledgeCaptureItem
CREATE TABLE "KnowledgeCaptureItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" "KnowledgeCaptureItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "evidence" JSONB,
    "confidence" DOUBLE PRECISION,
    "importance" DOUBLE PRECISION,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "status" "KnowledgeCaptureItemStatus" NOT NULL DEFAULT 'PROPOSED',
    "acceptedGraphUuid" TEXT,
    "mergeTargetUuid" TEXT,
    "rejectReason" "RejectReason",
    "reviewNotes" TEXT,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeCaptureItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KnowledgeCaptureItem" ADD CONSTRAINT "KnowledgeCaptureItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "KnowledgeCaptureBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "KnowledgeCaptureBatch_userId_workspaceId_createdAt_idx" ON "KnowledgeCaptureBatch"("userId", "workspaceId", "createdAt" DESC);
CREATE INDEX "KnowledgeCaptureBatch_conversationId_idx" ON "KnowledgeCaptureBatch"("conversationId");
CREATE INDEX "KnowledgeCaptureBatch_sessionId_idx" ON "KnowledgeCaptureBatch"("sessionId");
CREATE INDEX "KnowledgeCaptureItem_batchId_status_idx" ON "KnowledgeCaptureItem"("batchId", "status");
CREATE INDEX "KnowledgeCaptureItem_userId_workspaceId_status_updatedAt_idx" ON "KnowledgeCaptureItem"("userId", "workspaceId", "status", "updatedAt" DESC);
CREATE INDEX "KnowledgeCaptureItem_kind_status_idx" ON "KnowledgeCaptureItem"("kind", "status");
CREATE INDEX "KnowledgeCaptureItem_acceptedGraphUuid_idx" ON "KnowledgeCaptureItem"("acceptedGraphUuid");

-- AlterTable: WikiEntry — add reject reason columns
ALTER TABLE "WikiEntry"
  ADD COLUMN "rejectReason" "RejectReason",
  ADD COLUMN "reviewNotes" TEXT;