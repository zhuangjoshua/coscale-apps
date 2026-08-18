import { defineConfig, loadEnv, type Plugin } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Fills __SITE_URL__ in robots.txt / sitemap.xml after public/ is copied to dist/. */
function siteUrlInPublicFiles(siteUrl: string): Plugin {
  return {
    name: "site-url-in-public-files",
    closeBundle() {
      for (const file of ["robots.txt", "sitemap.xml"]) {
        const path = join("dist", file);
        try {
          writeFileSync(path, readFileSync(path, "utf8").replaceAll("__SITE_URL__", siteUrl));
        } catch {
          /* file not present in this build; nothing to fill */
        }
      }
    },
  };
}
import react from "@vitejs/plugin-react";

// Static SPA only: no server code, no API routes. `vite build` -> dist/.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Public origin for canonical / og:url / structured data. Set VITE_SITE_URL at build
  // time; falls back to localhost so a bare `vite build` never emits a wrong domain
  // silently — it emits an obviously-local one.
  const siteUrl = (env.VITE_SITE_URL || "http://localhost:4310").replace(/\/$/, "");
  return {
  plugins: [react(), siteUrlInPublicFiles(siteUrl)],
  define: { "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl) },
  resolve: {
    alias: {
      // All app code consumes the Takyon kit through _takyon/ only. In real
      // products the platform overwrites _takyon/ wholesale, so this alias is
      // the single seam between app code and the platform-provided kit.
      "@takyon": new URL("./_takyon", import.meta.url).pathname,
    },
  },
  build: {
    outDir: "dist",
  },
  };
});
