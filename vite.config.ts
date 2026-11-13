import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Ship public/ (favicon, OG image, ...) as usual, except the Git-ignored local price snapshot.
function publicFilesWithoutSnapshot(): Plugin {
  let publicDir = "";
  return {
    name: "histock-public-files-without-snapshot",
    apply: "build",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle() {
      if (!publicDir || !existsSync(publicDir)) return;
      for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
        const file = path.join(entry.parentPath, entry.name);
        const fileName = path.relative(publicDir, file).split(path.sep).join("/");
        if (entry.isFile() && fileName !== "snapshot.json")
          this.emitFile({ type: "asset", fileName, source: readFileSync(file) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), publicFilesWithoutSnapshot()],
  // Vite would copy public/ wholesale, including the local snapshot; the plugin above copies the rest.
  build: { copyPublicDir: false },
  server: { proxy: { "/api": "http://127.0.0.1:8080" } },
});
