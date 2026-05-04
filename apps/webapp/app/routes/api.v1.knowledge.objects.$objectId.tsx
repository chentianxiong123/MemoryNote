import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getKnowledgeObjectDetail } from "~/services/knowledge-capture.server";

const ParamsSchema = z.object({
  objectId: z.string(),
});

const loader = createHybridLoaderApiRoute(
  {
    params: ParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ params, authentication }) => {
    const detail = await getKnowledgeObjectDetail(
      params.objectId,
      authentication.userId,
      authentication.workspaceId as string,
    );

    return json(detail);
  },
);

export { loader };
