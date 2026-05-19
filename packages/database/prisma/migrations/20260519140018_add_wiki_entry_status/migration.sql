-- CreateEnum
CREATE TYPE "WikiEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REJECTED');

-- AlterTable: WikiEntry — add status + reviewedAt
-- New entries are DRAFT by default; backfill all existing rows as PUBLISHED
-- so prior auto-generated content stays visible until the user prunes it.
ALTER TABLE "WikiEntry"
  ADD COLUMN "status" "WikiEntryStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "WikiEntry" SET "status" = 'PUBLISHED', "reviewedAt" = "createdAt";

-- Index for fast Wiki list filtering by workspace + status
CREATE INDEX "WikiEntry_workspaceId_status_updatedAt_idx" ON "WikiEntry" ("workspaceId", "status", "updatedAt" DESC);
