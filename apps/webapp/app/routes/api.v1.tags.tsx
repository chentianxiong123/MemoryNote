import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const DEFAULT_BLOCKED_PATTERNS = [/^\d+$/, /^-?\d+\.?\d*$/];

function isDefaultValue(word: string): boolean {
  return DEFAULT_BLOCKED_PATTERNS.some((pattern) => pattern.test(word.trim()));
}

const TagCloudParams = z.object({
  minDocs: z.string().optional(),
  limit: z.string().optional(),
});

const loader = createHybridLoaderApiRoute(
  {
    params: z.object({}),
    searchParams: TagCloudParams,
    findResource: async () => 1,
    corsStrategy: "all",
    allowJWT: true,
  },
  async ({ authentication, searchParams }) => {
    const minDocs = parseInt(searchParams.minDocs || "2");
    const limit = parseInt(searchParams.limit || "100");

    const blockedKeywords = await prisma.blockedKeyword.findMany({
      select: { word: true },
    });
    const blockedWords = blockedKeywords.map((k) => k.word.toLowerCase());

    let tags: any[];
    if (blockedWords.length === 0) {
      tags = await prisma.$queryRaw`
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
    } else {
      const placeholders = blockedWords.map((_, i) => `$${i + 2}`).join(", ");
      const limitParam = blockedWords.length + 2;
      tags = await prisma.$queryRawUnsafe(
        `SELECT word, COUNT(DISTINCT document_id)::int as doc_count, SUM(CAST(rank AS DOUBLE PRECISION))::float as total_weight FROM "document_keywords" GROUP BY word HAVING COUNT(DISTINCT document_id) >= $1 AND LOWER(word) NOT IN (${placeholders}) ORDER BY doc_count DESC, total_weight DESC LIMIT $${limitParam}`,
        minDocs,
        ...blockedWords,
        limit
      );
    }

    const filteredTags = tags.filter((t: any) => !isDefaultValue(t.word));
    return json({ tags: filteredTags });
  },
);

export { loader };
