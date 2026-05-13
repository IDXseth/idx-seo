import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type-checking during next build — tsc runs separately in CI.
  typescript: { ignoreBuildErrors: true },

  // Treat large server-only packages as Node externals so webpack skips
  // bundling them — the main driver of slow builds in this project.
  serverExternalPackages: [
    'openai',
    '@anthropic-ai/sdk',
    '@google/generative-ai',
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg',
  ],
  experimental: {
    // Tree-shake icon imports so webpack only compiles icons actually used.
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
