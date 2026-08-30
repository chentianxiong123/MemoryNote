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
    if (!"personal") {
      return json({ error: "No workspace found" }, { status: 404 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { id: "personal" },
      select: { id: true, name: true, metadata: true },
    });

    if (!workspace) {
      return json({ error: "Workspace not found" }, { status: 404 });
    }

    const meta = (workspace.metadata ?? {}) as Record<string, unknown>;
    return json({
      id: workspace.id,
      name: workspace.name,
      accentColor: (meta.accentColor as string) || "#c87844",
    });
  },
);

export { loader };
