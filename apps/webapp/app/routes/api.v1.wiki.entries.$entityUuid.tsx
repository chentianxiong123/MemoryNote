import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const ParamsSchema = z.object({
  entityUuid: z.string(),
});

export const loader = createHybridLoaderApiRoute(
  {
    params: ParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ params, authentication }) => {
    if (!"personal") {
      throw new Response("Workspace not found", { status: 404 });
    }

    const wikiEntry = await prisma.wikiEntry.findUnique({
      where: {
        entityUuid_workspaceId: {
          entityUuid: params.entityUuid,
          
        },
      },
    });

    if (!wikiEntry) {
      throw new Response("Wiki entry not found", { status: 404 });
    }

    return json(wikiEntry);
  },
);
