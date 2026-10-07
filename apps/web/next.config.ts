import { resolve } from "node:path";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { assertWebEnv } from "./src/shared/lib/runtime/web-env";
import { requireApiUrl } from "./src/shared/server/transport/api-url";

// Runs during `next build`, where the real NEXT_PUBLIC_* values are still in
// process.env before inlining — a malformed value fails the build loud here.
assertWebEnv();

const API_URL = requireApiUrl();

// Docker development keeps its build output separate from native Next.js.
const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // The repository owns its agent guidance; `next dev` must not create local copies.
  agentRules: false,
  output: "standalone",
  // Next 16.3.7 (webpack) traces `server/proxy.js` into next-server, then
  // renames it to `middleware.js` before the standalone copy, so a clean Linux
  // build fails with ENOENT on copyfile. The renamed file is traced separately.
  // The glob must follow NEXT_DIST_DIR — a fixed `.next` path leaves the
  // Docker-dev build unexcluded and the copy fails on the custom dir instead.
  outputFileTracingExcludes: {
    "next-server": [
      `**/${distDir}/server/proxy.js`,
      `**/${distDir}/server/proxy.js.nft.json`,
    ],
  },
  reactCompiler: true,
  transpilePackages: ["@customreport/ui"],
  experimental: {
    useTypeScriptCli: false,
    optimizePackageImports: ["lucide-react"],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir,
  // shared uses NodeNext `.js` specifiers that point at `.ts` sources.
  webpack: (config: {
    resolve: { extensionAlias?: Record<string, string[]> };
  }) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
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

// Wrap with Sentry so the SDK's build-time instrumentation (client config
// detection and server hooks) is applied. Source-map upload stays disabled;
// `silent` outside CI keeps the dev build quiet.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  sourcemaps: { disable: true },
});
