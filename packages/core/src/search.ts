import { z } from "zod";
import type { Prisma, PrismaClient } from "@core/database";

export const DEFAULT_BLOCKED_PATTERNS = [/^\d+$/, /^-?\d+\.?\d*$/] as const;

export function isDefaultBlockedValue(word: string): boolean {
  return DEFAULT_BLOCKED_PATTERNS.some((pattern) => pattern.test(word.trim()));
}

export type SearchClient = Pick<
  PrismaClient,
  "document" | "conversation" | "blockedKeyword" | "$queryRaw" | "$queryRawUnsafe"
>;

export const KeywordSearchParamsSchema = z.object({
  keyword: z.string(),
  limit: z.string().optional(),
});

export interface KeywordSearchDoc {
  id: string;
  title: string | null;
  source: string;
  createdAt: Date;
  score: number;
}

export async function searchByKeyword(
  db: SearchClient,
  keyword: string,
  limit = 25,
): Promise<KeywordSearchDoc[]> {
  return db.$queryRaw<KeywordSearchDoc[]>`
    SELECT
      d.id,
      d.title,
      d."source",
      d."createdAt",
      dk.rank as score
    FROM "document_keywords" dk
    JOIN "Document" d ON d.id = dk.document_id
    WHERE dk.word = ${keyword}
      AND d.deleted IS NULL
    ORDER BY dk.rank DESC
    LIMIT ${limit}
  `;
}

export const TagCloudParamsSchema = z.object({
  minDocs: z.string().optional(),
  limit: z.string().optional(),
});

export interface TagCloudItem {
  word: string;
  doc_count: number;
  total_weight: number;
}

export async function getTagCloud(
  db: SearchClient,
  opts: { minDocs?: number; limit?: number } = {},
): Promise<TagCloudItem[]> {
  const minDocs = opts.minDocs ?? 2;
  const limit = opts.limit ?? 100;

  const blockedKeywords = await db.blockedKeyword.findMany({ select: { word: true } });
  const blockedWords = blockedKeywords.map((k) => k.word.toLowerCase());

  if (blockedWords.length === 0) {
    return db.$queryRaw<TagCloudItem[]>`
      SELECT word, doc_count, total_weight FROM (
        SELECT
          word,
          COUNT(DISTINCT document_id)::int as doc_count,
          SUM(CAST(rank AS DOUBLE PRECISION))::float as total_weight
        FROM "document_keywords"
        GROUP BY word
        HAVING COUNT(DISTINCT document_id) >= ${minDocs}

        UNION ALL

        SELECT
          word,
          doc_count::int,
          total_count::float
        FROM "memorynote"."conversation_keywords"
        WHERE doc_count >= ${minDocs}
      ) combined
      ORDER BY doc_count DESC, total_weight DESC
      LIMIT ${limit}
    `;
  }

  const placeholders = blockedWords.map((_, i) => `$${i + 2}`).join(", ");
  const limitParam = blockedWords.length + 2;
  return db.$queryRawUnsafe<TagCloudItem[]>(
    `SELECT word, COUNT(DISTINCT document_id)::int as doc_count, SUM(CAST(rank AS DOUBLE PRECISION))::float as total_weight FROM "document_keywords" GROUP BY word HAVING COUNT(DISTINCT document_id) >= $1 AND LOWER(word) NOT IN (${placeholders}) ORDER BY doc_count DESC, total_weight DESC LIMIT $${limitParam}`,
    minDocs,
    ...blockedWords,
    limit,
  );
}

export function filterDefaultValues<T extends { word: string }>(tags: T[]): T[] {
  return tags.filter((t) => !isDefaultBlockedValue(t.word));
}

export type { Prisma };
