import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { routeApi } from "./server/router.js";

function apiRoutes() {
  const attach = (server) => {
    const fileEnv = loadEnv(server.config.mode, server.config.root, "");
    const env = { ...fileEnv, ...process.env };
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/api/")) return next();
      routeApi(req, res, env).then((handled) => {
        if (!handled) next();
      }).catch((err) => {
        console.error("API route error:", err);
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "server_error", message: "Internal server error" }));
        }
      });
    });
  };

  return {
    name: "unimatch-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiRoutes()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
