import type { NextConfig } from "next";

const MARKETING_ORIGIN =
  process.env.MARKETING_ORIGIN || "http://localhost:8833";

const nextConfig: NextConfig = {
  async rewrites() {
    // Marketing SPA assets are served live from the Takyon preview server so
    // site rebuilds show up without re-syncing (page shells proxy in lib/spa.ts).
    return [
      { source: "/assets/:path*", destination: `${MARKETING_ORIGIN}/assets/:path*` },
      { source: "/proto-assets/:path*", destination: `${MARKETING_ORIGIN}/proto-assets/:path*` },
      { source: "/favicon.svg", destination: `${MARKETING_ORIGIN}/favicon.svg` },
    ];
  },
};

export default nextConfig;
