import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL;

  if (command === "build" && mode === "production" && !apiBase?.trim()) {
    throw new Error(
      "VITE_API_BASE_URL is required for production builds. Set it to the Railway API origin."
    );
  }

  return {
    plugins: [react()],
  };
});
