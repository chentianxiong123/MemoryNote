import { json } from "@remix-run/node";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getKnowledgeInboxData } from "~/services/knowledge-capture.server";

const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication }) => {
    const data = await getKnowledgeInboxData(
      authentication.userId,
      authentication.workspaceId as string,
    );

    return json(data);
  },
);

export { loader };
