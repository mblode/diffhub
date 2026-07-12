import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["diffhub.localhost", "*.diffhub.localhost"],
  logging: {
    browserToTerminal: true,
  },
  // Standalone output: produces .next/standalone/apps/cli/server.js — a
  // self-contained server that works without a full Next.js install and ships
  // in the npm package.
  output: "standalone",
  // Monorepo: point tracing root at the repo root so Next.js can resolve packages
  // hoisted to the root node_modules. The standalone output lands at
  // .next/standalone/apps/cli/server.js (mirroring the workspace path).
  outputFileTracingRoot: join(import.meta.dirname, "../.."),
  reactCompiler: true,
  // Source-only workspace package shared with apps/web — Next transpiles it.
  transpilePackages: ["@diffhub/diff-core"],
  // TS 7's compiler API moved to typescript/unstable/*, which Next's built-in
  // inline check can't load. `check-types` (tsc --noEmit) is the real gate;
  // this only disables Next's redundant build-time type check.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
