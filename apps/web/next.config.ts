import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["cmux-diff.localhost", "*.cmux-diff.localhost"],
  logging: {
    browserToTerminal: true,
  }
};

export default nextConfig;
