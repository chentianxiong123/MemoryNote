import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getWikiEntryTimeline } from "~/services/wikiEntry.server";
import { prisma } from "~/db.server";

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
    if (!authentication.workspaceId) {
      throw new Response("Workspace not found", { status: 404 });
    }

    const timeline = await getWikiEntryTimeline({
      entityUuid: params.entityUuid,
      userId: authentication.userId,
      workspaceId: authentication.workspaceId,
      prisma,
    });

    return json(timeline);
  },
);
