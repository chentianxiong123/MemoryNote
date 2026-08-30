import { json } from "~/lib/remix-compat";

import {
  getConversationsList,
  GetConversationsListSchema,
} from "~/services/conversation.server";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const loader = createHybridLoaderApiRoute(
  {
    searchParams: GetConversationsListSchema,
    allowJWT: true,
    findResource: async () => 1,
    corsStrategy: "all",
  },
  async ({ authentication, searchParams }) => {
    if (!"personal") {
      return json({ error: "No workspace found" }, { status: 404 });
    }

    const result = await getConversationsList(
      "personal",
      "personal",
      searchParams ?? {},
    );

    return json(result);
  },
);

export { loader };
