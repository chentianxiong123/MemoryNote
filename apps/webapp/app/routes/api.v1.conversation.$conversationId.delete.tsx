import { json } from "~/lib/remix-compat";
import { z } from "zod";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { deleteConversation } from "~/services/conversation.server";

const ParamsSchema = z.object({
  conversationId: z.string(),
});

const { action, loader } = createHybridActionApiRoute(
  {
    params: ParamsSchema,
    method: "DELETE",
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, params }) => {
    await deleteConversation(params.conversationId);
    return json({ ok: true });
  },
);

export { action, loader };
