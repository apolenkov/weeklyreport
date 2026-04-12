import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  reactCompiler: true,
  transpilePackages: ['@customreport/ui'],
  turbopack: {
    root: resolve(__dirname, '../..'),
  },
  rewrites: async () => [
    { source: '/trpc/:path*', destination: `${API_URL}/trpc/:path*` },
    { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
    { source: '/health/:path*', destination: `${API_URL}/health/:path*` },
  ],
};

export default nextConfig;
