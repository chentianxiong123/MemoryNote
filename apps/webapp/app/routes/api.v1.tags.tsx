import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

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

    const tags = await prisma.$queryRaw`
      SELECT 
        word,
        COUNT(DISTINCT document_id)::int as doc_count,
        SUM(CAST(rank AS DOUBLE PRECISION))::float as total_weight
      FROM "document_keywords"
      GROUP BY word
      HAVING COUNT(DISTINCT document_id) >= ${minDocs}
      ORDER BY doc_count DESC, total_weight DESC
      LIMIT ${limit}
    `;

    return json({ tags });
  },
);

export { loader };
