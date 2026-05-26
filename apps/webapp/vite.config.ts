import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  ssr: {
    noExternal: [
      "isbot",
      "@remix-run/react",
      "@remix-run/server-runtime",
    ],
  },
});