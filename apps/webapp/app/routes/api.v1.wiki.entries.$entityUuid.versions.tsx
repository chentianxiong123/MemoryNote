import { json } from "@remix-run/node";
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
    if (!authentication.workspaceId) {
      throw new Response("Workspace not found", { status: 404 });
    }

    // First, find the wiki entry by entityUuid
    const wikiEntry = await prisma.wikiEntry.findUnique({
      where: {
        entityUuid_workspaceId: {
          entityUuid: params.entityUuid,
          workspaceId: authentication.workspaceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!wikiEntry) {
      throw new Response("Wiki entry not found", { status: 404 });
    }

    // Get all versions for this wiki entry
    const versions = await prisma.wikiEntryVersion.findMany({
      where: {
        wikiEntryId: wikiEntry.id,
      },
      orderBy: {
        version: "desc",
      },
    });

    return json(versions);
  },
);
