import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["diffhub.localhost", "*.diffhub.localhost"],
  logging: {
    browserToTerminal: true,
  },
  // Standalone output: produces .next/standalone/server.js — a self-contained server
  // that works without a full Next.js install. Shipped in the npm package.
  output: "standalone",
  // Monorepo: point tracing root at the repo root so Next.js can resolve packages
  // hoisted to the root node_modules. The standalone output lands at
  // .next/standalone/apps/web/server.js (mirroring the workspace path).
  outputFileTracingRoot: join(import.meta.dirname, "../.."),
  reactCompiler: true,
};

export default nextConfig;
