import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { apiBoundaryMiddleware } from "./server/vite-middleware.ts";

function evidenceBoundaryPlugin(): Plugin {
  return {
    name: "repoflow-evidence-boundary",
    configureServer(server) {
      server.middlewares.use(apiBoundaryMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiBoundaryMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), evidenceBoundaryPlugin()],
});
