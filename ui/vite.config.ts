import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Rust control server port for dev proxy (default 8787). Set RLM_CONTROL_PORT when the server uses a different port.
const controlPort = process.env.RLM_CONTROL_PORT ?? "8787";

export default defineConfig({
  root: "ui",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${controlPort}`,
        changeOrigin: true,
      },
    },
  },
});
