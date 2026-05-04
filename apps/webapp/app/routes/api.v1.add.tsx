import { json } from "@remix-run/node";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { addToQueue } from "~/lib/ingest.server";
import { IngestBodyRequest } from "~/jobs/ingest/ingest-episode.logic";

const { action, loader } = createHybridActionApiRoute(
  {
    body: IngestBodyRequest,
    allowJWT: true,
    authorization: {
      action: "ingest",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const response = await addToQueue(body, authentication.userId, authentication?.workspaceId as string);
    return json({ success: true, id: response.id });
  },
);

export { action, loader };
