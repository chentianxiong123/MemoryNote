import { json } from "@remix-run/node";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import {
  mergeKnowledgeCaptureItem,
  parseMergeCaptureItemBody,
} from "~/services/knowledge-capture.server";

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
  async ({ params, authentication, request }) => {
    const body = parseMergeCaptureItemBody(await request.json());
    const item = await mergeKnowledgeCaptureItem(
      params.itemId,
      body,
      authentication.userId,
      authentication.workspaceId as string,
    );

    return json({ success: true, item });
  },
);

export { action, loader };
