import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const KeywordParams = z.object({
  keyword: z.string(),
  limit: z.string().optional(),
});

const loader = createHybridLoaderApiRoute(
  {
    params: z.object({}),
    searchParams: KeywordParams,
    findResource: async () => 1,
    corsStrategy: "all",
    allowJWT: true,
  },
  async ({ authentication, searchParams }) => {
    const keyword = searchParams.keyword;
    const limit = parseInt(searchParams.limit || "25");

    const documents = await prisma.$queryRaw`
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

    return json({ documents, keyword });
  },
);

export { loader };
