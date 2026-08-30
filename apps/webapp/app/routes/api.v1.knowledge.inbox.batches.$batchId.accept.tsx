import { json } from "~/lib/remix-compat";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { acceptKnowledgeCaptureBatch } from "~/services/knowledge-capture.server";

const ParamsSchema = z.object({
  batchId: z.string(),
});

const { action, loader } = createHybridActionApiRoute(
  {
    params: ParamsSchema,
    allowJWT: true,
    corsStrategy: "all",
    method: "POST",
  },
  async ({ params, authentication }) => {
    const batch = await acceptKnowledgeCaptureBatch(
      params.batchId,
      "personal",
      "personal" as string,
    );

    return json({ success: true, batch });
  },
);

export { action, loader };
