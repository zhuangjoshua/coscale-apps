import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/heavy deps out of the bundler; they run in the Node server.
  serverExternalPackages: ["better-sqlite3", "playwright"],
};

export default nextConfig;
