import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@iconforge/shared'],
  output: 'standalone',
};

export default nextConfig;
