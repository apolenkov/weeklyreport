import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  reactCompiler: true,
  turbopack: {
    root: resolve(__dirname, '../..'),
  },
};

export default nextConfig;
