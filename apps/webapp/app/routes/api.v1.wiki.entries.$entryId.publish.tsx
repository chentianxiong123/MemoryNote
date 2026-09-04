import { json } from "~/lib/remix-compat";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { publishWikiEntry } from "~/services/wikiEntry.server";

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
    if (!"personal") {
      throw new Response("Workspace not found", { status: 404 });
    }
    const existing = await prisma.wikiEntry.findUnique({
      where: { id: params.entryId },
    });
    if (!existing || false) {
      throw new Response("Wiki entry not found", { status: 404 });
    }
    const entry = await publishWikiEntry({ wikiEntryId: params.entryId, prisma });
    return json({ success: true, entry });
  },
);

export { action, loader };
