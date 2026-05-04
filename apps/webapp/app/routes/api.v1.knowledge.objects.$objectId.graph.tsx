import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getKnowledgeObjectGraph } from "~/services/knowledge-capture.server";

const ParamsSchema = z.object({
  objectId: z.string(),
});

const SearchParamsSchema = z.object({
  depth: z.coerce.number().int().min(1).max(2).optional(),
  limit: z.coerce.number().int().min(5).max(80).optional(),
});

const loader = createHybridLoaderApiRoute(
  {
    params: ParamsSchema,
    searchParams: SearchParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ params, searchParams, authentication }) => {
    const graph = await getKnowledgeObjectGraph(
      params.objectId,
      authentication.userId,
      authentication.workspaceId as string,
      searchParams?.depth ?? 1,
      searchParams?.limit ?? 40,
    );

    return json(graph);
  },
);

export { loader };
