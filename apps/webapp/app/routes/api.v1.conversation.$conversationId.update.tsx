import { json } from "~/lib/remix-compat";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { updateConversationTitle } from "~/services/conversation.server";

const ParamsSchema = z.object({
  conversationId: z.string(),
});

const BodySchema = z.object({
  title: z.string().min(1).max(200),
});

const { action, loader } = createHybridActionApiRoute(
  {
    params: ParamsSchema,
    body: BodySchema,
    method: "PUT",
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, params, body }) => {
    await updateConversationTitle(params.conversationId, body.title);
    return json({ ok: true });
  },
);

export { action, loader };
