import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL;
  const analyze = process.env.npm_lifecycle_event === "build:analyze";

  if (command === "build" && mode === "production" && !apiBase?.trim()) {
    throw new Error(
      "VITE_API_BASE_URL is required for production builds. Set it to the Railway API origin."
    );
  }

  return {
    plugins: [
      react(),
      reactRouter(),
      // Analyzer is opt-in through npm run build:analyze so normal builds pay no cost.
      analyze &&
        visualizer({
          filename: "dist/performance/bundle-analysis.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
    ].filter(Boolean),
  };
});
