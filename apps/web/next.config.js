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
    // Every matching rule is applied in order and a later one wins on a
    // repeated key, so the catch-all has to come FIRST. With it last it
    // overwrote all three shareable-asset rules below and every one of them
    // served `same-origin`, which is the opposite of what they were added for:
    // a card image an unfurler cannot fetch cross-origin is a blank card.
    const shareable = ["/opengraph-image.png", "/twitter-image.png", "/web-app-manifest-:size.png"];
    return [
      {
        headers: securityHeaders,
        source: "/(.*)",
      },
      ...shareable.map((source) => ({
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Cross-Origin-Resource-Policy"),
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
        source,
      })),
    ];
  },
  reactCompiler: true,
  redirects() {
    // The vanity host stays attached to this Vercel project, so the 308 onto
    // the canonical blode.co zone path has to happen here.
    //
    // Paths that already include the basePath must be matched first. A bare
    // `/:path*` captures `diffhub/cmux-git-diff` and rewrites it to
    // `/diffhub/diffhub/cmux-git-diff` — a 404. Search Console reports that
    // as a Redirect error: the 308 lands on a missing page.
    //
    // No loop on the live zone: blode.co/diffhub proxies to
    // diffhub.zone.blode.co, whose host does not match these rules.
    const vanityHost = [{ type: "host", value: "diffhub.blode.co" }];
    return [
      {
        basePath: false,
        destination: `https://blode.co${basePath}`,
        has: vanityHost,
        permanent: true,
        source: basePath,
      },
      {
        basePath: false,
        destination: `https://blode.co${basePath}/:path*`,
        has: vanityHost,
        permanent: true,
        source: `${basePath}/:path*`,
      },
      {
        basePath: false,
        destination: `https://blode.co${basePath}`,
        has: vanityHost,
        permanent: true,
        source: "/",
      },
      {
        basePath: false,
        destination: `https://blode.co${basePath}/:path*`,
        has: vanityHost,
        permanent: true,
        source: "/:path*",
      },
      // Heal doubled-basePath URLs already produced by the old vanity rules
      // (or typed by hand). Same on every host, including blode.co.
      {
        basePath: false,
        destination: basePath,
        permanent: true,
        source: `${basePath}${basePath}`,
      },
      {
        basePath: false,
        destination: `${basePath}/:path*`,
        permanent: true,
        source: `${basePath}${basePath}/:path*`,
      },
    ];
  },
  transpilePackages: ["@diffhub/diff-core"],
};

export default nextConfig;
