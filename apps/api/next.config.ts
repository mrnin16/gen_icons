import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@iconforge/shared'],
  output: 'standalone',
  serverExternalPackages: ['@resvg/resvg-js', 'gif-encoder-2'],
};

export default nextConfig;
