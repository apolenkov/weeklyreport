import { resolve } from "node:path";

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

import { assertWebEnv } from "./src/shared/lib/runtime/web-env";
import { requireApiUrl } from "./src/shared/server/transport/api-url";

// Runs during `next build`, where the real NEXT_PUBLIC_* values are still in
// process.env before inlining — a malformed value fails the build loud here.
assertWebEnv();

const API_URL = requireApiUrl();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@customreport/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
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
      // Authenticated PDF artifact download — served by the API's authorized
      // /pdfs handler (the ambient session cookie rides the same-origin GET).
      { source: "/pdfs/:path*", destination: `${API_URL}/pdfs/:path*` },
    ]),
};

// correlate-errors-to-traces: wrap with Sentry so the SDK's build-time
// instrumentation (client config detection, server hooks) is applied. Source-map
// upload to Bugsink is DISABLED by default — it is gated on a separate
// sentry-cli/debug-id preflight (see openspec/changes/correlate-errors-to-traces,
// task 5.2). `silent` outside CI keeps the dev build quiet.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  sourcemaps: { disable: true },
});
