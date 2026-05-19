import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { rejectWikiEntry } from "~/services/wikiEntry.server";

const ParamsSchema = z.object({
  entryId: z.string(),
});

const { action, loader } = createHybridActionApiRoute(
  {
    params: ParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    method: "POST",
  },
  async ({ params, authentication }) => {
    if (!authentication.workspaceId) {
      throw new Response("Workspace not found", { status: 404 });
    }
    const existing = await prisma.wikiEntry.findUnique({
      where: { id: params.entryId },
    });
    if (!existing || existing.workspaceId !== authentication.workspaceId) {
      throw new Response("Wiki entry not found", { status: 404 });
    }
    const entry = await rejectWikiEntry({ wikiEntryId: params.entryId, prisma });
    return json({ success: true, entry });
  },
);

export { action, loader };
