import { json } from "~/lib/remix-compat";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getProviders } from "~/services/llm-provider.server";

const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    findResource: async () => 1,
    corsStrategy: "all",
  },
  async ({ authentication }) => {
    const providers = await getProviders("personal" as string | undefined);
    return json(providers);
  },
);

export { loader };
