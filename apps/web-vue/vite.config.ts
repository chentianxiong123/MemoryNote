import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendOrigin = env.VITE_BACKEND_ORIGIN || "http://localhost:3033";

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 4173,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: "0.0.0.0",
    },
  };
});
