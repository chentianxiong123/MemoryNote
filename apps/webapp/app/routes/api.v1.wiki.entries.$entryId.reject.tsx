import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { rejectWikiEntry } from "~/services/wikiEntry.server";

const ParamsSchema = z.object({
  entryId: z.string(),
});

const BodySchema = z
  .object({
    reason: z.enum(["INACCURATE", "IRRELEVANT", "DUPLICATE", "TRIVIAL", "OTHER"]).optional(),
    notes: z.string().max(2000).optional(),
  })
  .optional();

const { action, loader } = createHybridActionApiRoute(
  {
    params: ParamsSchema,
    body: BodySchema,
    allowJWT: true,
    corsStrategy: "all",
    method: "POST",
  },
  async ({ params, body, authentication }) => {
    if (!authentication.workspaceId) {
      throw new Response("Workspace not found", { status: 404 });
    }
    const existing = await prisma.wikiEntry.findUnique({
      where: { id: params.entryId },
    });
    if (!existing || existing.workspaceId !== authentication.workspaceId) {
      throw new Response("Wiki entry not found", { status: 404 });
    }
    const entry = await rejectWikiEntry({
      wikiEntryId: params.entryId,
      prisma,
      reason: body?.reason,
      notes: body?.notes,
    });
    return json({ success: true, entry });
  },
);

export { action, loader };
