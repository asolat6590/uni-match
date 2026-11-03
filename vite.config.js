import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleMatch } from "./server/gemini.js";

function geminiApi() {
  const attach = (server) => {
    const fileEnv = loadEnv(server.config.mode, server.config.root, "");
    const env = { ...fileEnv, ...process.env };
    server.middlewares.use("/api/match", (req, res) => {
      handleMatch(req, res, env);
    });
  };

  return {
    name: "unimatch-gemini",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), geminiApi()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
