import { resolve } from "node:path";

import type { NextConfig } from "next";

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3002";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@customreport/ui"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Allow E2E to spawn a parallel dev server alongside the user's
  // running dev process. Next.js 16 has a sibling-process guard that
  // matches by repo dir (not port), so the E2E webServer must use a
  // distinct .next dir to satisfy it. NEXT_DIST_DIR is set by
  // playwright.config.ts.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
  rewrites: () =>
    Promise.resolve([
      { source: "/trpc/:path*", destination: `${API_URL}/trpc/:path*` },
      { source: "/auth/:path*", destination: `${API_URL}/auth/:path*` },
      { source: "/health/:path*", destination: `${API_URL}/health/:path*` },
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
    ]),
};

export default nextConfig;
