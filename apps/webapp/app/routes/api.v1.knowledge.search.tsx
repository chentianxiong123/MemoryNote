import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { searchKnowledgeObjects } from "~/services/knowledge-capture.server";

const SearchParamsSchema = z.object({
  q: z.string().optional(),
});

const loader = createHybridLoaderApiRoute(
  {
    searchParams: SearchParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ searchParams, authentication }) => {
    const data = await searchKnowledgeObjects(
      searchParams?.q ?? "",
      authentication.userId,
      authentication.workspaceId as string,
    );

    return json(data);
  },
);

export { loader };
