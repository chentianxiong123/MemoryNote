import { json } from "~/lib/remix-compat";
import { prisma } from "~/db.server";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    findResource: async () => 1,
    corsStrategy: "all",
  },
  async ({ authentication }) => {
    return json({
      id: "personal",
      name: "Personal",
      accentColor: "#c87844",
    });
  },
);

export { loader };
