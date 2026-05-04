import { json } from "@remix-run/node";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getKnowledgeHomeData } from "~/services/knowledge-capture.server";

const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication }) => {
    const data = await getKnowledgeHomeData(
      authentication.userId,
      authentication.workspaceId as string,
    );

    return json(data);
  },
);

export { loader };
