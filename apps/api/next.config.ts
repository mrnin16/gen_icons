import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Make Next.js bundle code from the @iconforge/shared workspace package.
  // Without this, Next would try to externalize it and fail at runtime.
  transpilePackages: ['@iconforge/shared'],

  // Standalone output produces a minimal node_modules + server bundle for
  // smaller Docker images and faster cold starts on Railway.
  output: 'standalone',
};

export default nextConfig;
