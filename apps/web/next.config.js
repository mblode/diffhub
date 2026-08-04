import { readFileSync } from "node:fs";

import { basePath } from "./lib/config.ts";

let version = "0.0.0";
try {
  ({ version } = JSON.parse(
    readFileSync(new URL("../cli/package.json", import.meta.url), "utf-8"),
  ));
} catch {
  // CLI package unavailable in standalone Vercel deployments
}

const posthogOrigin = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the diff viewer's shiki-wasm highlighter instantiate
  // its WebAssembly module (needed by the live PR demo's syntax highlighting).
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${posthogOrigin}${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  // The highlighter runs in a module worker spawned from a blob URL.
  "worker-src 'self' blob:",
  `connect-src 'self' ${posthogOrigin}`,
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: basePath,
  basePath,
  env: {
    DIFFHUB_VERSION: version,
  },
  experimental: {
    // Runs the React Compiler in Turbopack's Rust pipeline, so the build no
    // longer needs the Babel plugin.
    turbopackRustReactCompiler: true,
  },
  headers() {
    return [
      {
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Cross-Origin-Resource-Policy"),
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
        source: "/opengraph-image.png",
      },
      {
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Cross-Origin-Resource-Policy"),
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
        source: "/twitter-image.png",
      },
      {
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Cross-Origin-Resource-Policy"),
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
        source: "/web-app-manifest-:size.png",
      },
      {
        headers: securityHeaders,
        source: "/(.*)",
      },
    ];
  },
  reactCompiler: true,
  redirects() {
    return [
      {
        basePath: false,
        destination: `https://blode.co${basePath}`,
        has: [{ type: "host", value: "diffhub.blode.co" }],
        permanent: true,
        source: "/",
      },
      {
        basePath: false,
        destination: `https://blode.co${basePath}/:path*`,
        has: [{ type: "host", value: "diffhub.blode.co" }],
        permanent: true,
        source: "/:path*",
      },
    ];
  },
  transpilePackages: ["@diffhub/diff-core"],
};

export default nextConfig;
