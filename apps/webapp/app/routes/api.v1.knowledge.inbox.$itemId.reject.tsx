import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { rejectKnowledgeCaptureItem } from "~/services/knowledge-capture.server";

const ParamsSchema = z.object({
  itemId: z.string(),
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
    const item = await rejectKnowledgeCaptureItem(
      params.itemId,
      authentication.userId,
      authentication.workspaceId as string,
      { reason: body?.reason, notes: body?.notes },
    );

    return json({ success: true, item });
  },
);

export { action, loader };
