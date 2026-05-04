import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { snoozeKnowledgeCaptureItem } from "~/services/knowledge-capture.server";

const ParamsSchema = z.object({
  itemId: z.string(),
});

const { action, loader } = createHybridActionApiRoute(
  {
    params: ParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    method: "POST",
  },
  async ({ params, authentication }) => {
    const item = await snoozeKnowledgeCaptureItem(
      params.itemId,
      authentication.userId,
      authentication.workspaceId as string,
    );

    return json({ success: true, item });
  },
);

export { action, loader };
