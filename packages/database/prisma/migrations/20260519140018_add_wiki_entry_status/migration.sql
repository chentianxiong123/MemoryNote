-- CreateEnum
CREATE TYPE "WikiEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REJECTED');

-- CreateTable: WikiEntry — this table existed in the schema but was never
-- created by a migration (historical `prisma db push` usage), so when the
-- database is rebuilt from scratch it must be created here.
CREATE TABLE "WikiEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "entityUuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "WikiEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "WikiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WikiEntryVersion — same story, never had its own migration
CREATE TABLE "WikiEntryVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wikiEntryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceEpisodeUuid" TEXT,

    CONSTRAINT "WikiEntryVersion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WikiEntryVersion" ADD CONSTRAINT "WikiEntryVersion_wikiEntryId_fkey" FOREIGN KEY ("wikiEntryId") REFERENCES "WikiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "WikiEntry_entityUuid_workspaceId_key" ON "WikiEntry"("entityUuid", "workspaceId");
CREATE INDEX "WikiEntry_userId_workspaceId_idx" ON "WikiEntry"("userId", "workspaceId");
CREATE INDEX "WikiEntry_entityUuid_idx" ON "WikiEntry"("entityUuid");
CREATE INDEX "WikiEntryVersion_wikiEntryId_version_idx" ON "WikiEntryVersion"("wikiEntryId", "version");
CREATE INDEX "WikiEntry_workspaceId_status_updatedAt_idx" ON "WikiEntry"("workspaceId", "status", "updatedAt" DESC);