-- CreateEnum
CREATE TYPE "RejectReason" AS ENUM ('INACCURATE', 'IRRELEVANT', 'DUPLICATE', 'TRIVIAL', 'OTHER');

-- AlterTable: KnowledgeCaptureItem — capture *why* the user rejected each proposal
ALTER TABLE "KnowledgeCaptureItem"
  ADD COLUMN "rejectReason" "RejectReason",
  ADD COLUMN "reviewNotes" TEXT;

-- AlterTable: WikiEntry — same fields for wiki rejections
ALTER TABLE "WikiEntry"
  ADD COLUMN "rejectReason" "RejectReason",
  ADD COLUMN "reviewNotes" TEXT;
