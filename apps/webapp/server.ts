import compression from "compression";
import express, { Request, Response } from "express";
import morgan from "morgan";
import { createServer } from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ProviderFactory } from "@core/providers";
import { mountApiRoutes } from "./app/routeLoader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function init() {
  // Initialize ProviderFactory (Neo4j, pgvector, model providers)
  ProviderFactory.initializeFromEnv();

  const app = express();
  app.set("trust proxy", true);
  app.use(compression());
  app.disable("x-powered-by");
  app.use(morgan("tiny"));
  app.use(express.json({ limit: "10mb" }));

  // Mount all API routes from app/routes/api.v1.*.tsx
  console.log("Mounting API routes…");
  await mountApiRoutes(app);

  // Serve Vue frontend static files
  const frontendDist = join(__dirname, "../web-vue/dist");
  console.log(`Serving frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));

  // SPA fallback - all non-API routes return index.html
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(join(frontendDist, "index.html"));
  });

  const port = process.env.REMIX_APP_PORT || 3033;
  const server = createServer(app);
  server.listen(port, () => console.log(`Server listening at http://localhost:${port}`));
}

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
