import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Local design snapshots are excluded from distributable builds.
  build: { copyPublicDir: false },
  server: { proxy: { "/api": "http://127.0.0.1:8080" } },
});
