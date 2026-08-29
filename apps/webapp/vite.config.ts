import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
    conditions: ["import", "node"],
  },
  ssr: {
    noExternal: [/@core\//],
  },
});
