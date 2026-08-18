import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA only: no server code, no API routes. `vite build` -> dist/.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
