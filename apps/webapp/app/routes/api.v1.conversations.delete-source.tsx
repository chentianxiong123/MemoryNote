import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { deleteConversationsBySource } from "~/services/conversation.server";

const BodySchema = z.object({
  source: z.string().min(1),
});

const { action, loader } = createHybridActionApiRoute(
  {
    body: BodySchema,
    method: "DELETE",
  },
  async ({ body, authentication }) => {
    await deleteConversationsBySource("personal", body.source);
    return json({ ok: true });
  },
);

export { action, loader };
