import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createServer } from "http";
import { mountApiRoutes } from "./app/routeLoader.js";
async function init() {
    const app = express();
    app.set("trust proxy", true);
    app.use(compression());
    app.disable("x-powered-by");
    app.use(morgan("tiny"));
    app.use(express.json({ limit: "10mb" }));
    // Mount all API routes from app/routes/api.v1.*.tsx
    console.log("Mounting API routes…");
    await mountApiRoutes(app);
    const port = process.env.REMIX_APP_PORT || 3033;
    const server = createServer(app);
    server.listen(port, () => console.log(`Server listening at http://localhost:${port}`));
}
init().catch((err) => {
    console.error(err);
    process.exit(1);
});
