import type { NextConfig } from "next";
import path from "path";

// This app is part of an npm workspace (packages/shared), so `next` and
// other deps get hoisted to the monorepo root's node_modules instead of
// living locally in apps/admin — point Turbopack there so it can resolve
// its own package.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
