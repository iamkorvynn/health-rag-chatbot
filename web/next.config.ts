import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Static export for Cloudflare Pages hosting (no server needed:
     the app is a client component that calls the FastAPI backend). */
  output: "export",
  /* config options here */
  // NOTE: cacheComponents/partialPrefetching removed for the static export —
  // they conflict with `output: "export"` (manifest route needs force-static).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
